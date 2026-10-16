import { ConfigProvider, DateTime, Effect, Metric, Option, Result } from "effect";

import { CryptoService } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { OneClawError, ProviderConnectionError } from "@namera-ai/protocol";
import type {
  SigningKeyDeactivation,
  SigningKeyDeactivationErrorCode,
} from "@namera-ai/protocol/model";
import { workerBacklog, workerOldestAge } from "@namera-ai/telemetry";
import { OneClawOidcService, OneClawService } from "@namera-ai/wallet-provider-oneclaw";

import { Audit } from "#/audit/layer";
import { makeEnsureOneClawCustomer } from "#/oneclaw/customer";

const retryable = new Set<SigningKeyDeactivationErrorCode>([
  "TIMEOUT",
  "UNAVAILABLE",
  "RATE_LIMITED",
  "UNAUTHENTICATED",
  "AUTHORITY_EXPIRED",
  "PROVISIONING_INCOMPLETE",
]);

export const makeReconcileSigningKeyDeactivations = Effect.gen(function* () {
  const repository = yield* Repository;
  const crypto = yield* CryptoService;
  const transaction = yield* TransactionService;
  const audit = yield* Audit;
  const ensureCustomer = yield* makeEnsureOneClawCustomer;
  const provider = yield* Effect.serviceOption(OneClawService);
  const oidc = yield* Effect.serviceOption(OneClawOidcService);
  const configProvider = yield* ConfigProvider.ConfigProvider;
  const jobs = repository.jobs.signingKeyDeactivation;

  const deactivate = Effect.fn("application.sessionKey.deactivateSigner")(
    function* (job: SigningKeyDeactivation) {
      const operation = "signingKeys.deactivate";
      if (Option.isNone(provider) || Option.isNone(oidc))
        return yield* new OneClawError({ operation, code: "CONFIGURATION_INVALID" });
      const key = yield* repository.core.signingKey.findById(job.signingKeyId, job.organizationId);
      if (
        !key ||
        key.purpose !== "session" ||
        key.custody !== "namera-managed" ||
        key.status !== "disabled" ||
        key.algorithm !== "secp256k1" ||
        key.data.type !== "1claw" ||
        key.data.chain !== "ethereum" ||
        !key.providerConnectionId
      )
        return yield* new OneClawError({ operation, code: "KEY_MISMATCH" });
      const authority = yield* ensureCustomer(job.organizationId, {
        existingConnectionId: key.providerConnectionId,
      }).pipe(
        Effect.provideService(OneClawService, provider.value),
        Effect.provideService(OneClawOidcService, oidc.value),
      );

      yield* provider.value.signingKeys.deactivate({
        authority,
        agentId: key.data.agentId,
        key: {
          id: key.data.providerKeyId,
          version: key.data.keyVersion,
          publicKey: key.publicKeyHex,
        },
      });
    },
    Effect.provideService(ConfigProvider.ConfigProvider, configProvider),
    Effect.catchTag("CryptoError", () =>
      Effect.fail(new ProviderConnectionError({ code: "DECRYPT_FAILED" })),
    ),
    Effect.catchTag("ConfigError", () =>
      Effect.fail(
        new OneClawError({
          operation: "signingKeys.deactivate",
          code: "CONFIGURATION_INVALID",
        }),
      ),
    ),
    Effect.timeoutOrElse({
      duration: "2 minutes",
      orElse: () =>
        Effect.fail(new OneClawError({ operation: "signingKeys.deactivate", code: "TIMEOUT" })),
    }),
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const reconcile = Effect.fn("application.sessionKey.reconcileDeactivation")(function* () {
    const leaseToken = yield* crypto.randomToken();
    const claimedAt = yield* DateTime.now;
    const job = yield* jobs.claim({
      now: claimedAt,
      leaseToken,
      leaseExpiresAt: DateTime.add(claimedAt, { minutes: 3 }),
    });
    if (!job) return 0;
    const result = yield* deactivate(job).pipe(Effect.result);
    yield* transaction.run(
      Effect.gen(function* () {
        const now = yield* DateTime.now;
        const lease = { id: job.id, organizationId: job.organizationId, leaseToken, now };
        if (Result.isSuccess(result)) {
          if (!(yield* jobs.complete(lease))) return;
          yield* audit.organization(
            {
              organizationId: job.organizationId,
              actorId: null,
              event: "signing_key.deactivated",
              resourceType: "signing-key",
              resourceId: job.signingKeyId,
              data: { version: 1, provider: "1claw" },
            },
            { source: "system" },
          );
          return;
        }
        const code = result.failure.code;
        const status = retryable.has(code) && job.attempts < 12 ? "pending" : "needs-attention";
        const updated = yield* jobs.fail({
          ...lease,
          status,
          lastErrorCode: code,
          availableAt: DateTime.add(now, {
            seconds: Math.min(3600, 30 * 2 ** Math.min(job.attempts - 1, 7)),
          }),
        });
        if (updated && status === "needs-attention") {
          yield* audit.organization(
            {
              organizationId: job.organizationId,
              actorId: null,
              event: "signing_key.deactivation_failed",
              resourceType: "signing-key",
              resourceId: job.signingKeyId,
              data: { version: 1, provider: "1claw", errorCode: code },
            },
            { source: "system" },
          );
          yield* Effect.logWarning("session_key.deactivation.requires_attention").pipe(
            Effect.annotateLogs({ code }),
          );
        }
      }),
    );
    return 1;
  });

  return Effect.fn("application.sessionKey.reconcileDeactivations")(
    function* () {
      const backlog = yield* jobs.getBacklog(yield* DateTime.now);
      yield* Metric.update(
        Metric.withAttributes(workerBacklog, { worker: "signing_key_deactivation" }),
        backlog.count,
      );
      yield* Metric.update(
        Metric.withAttributes(workerOldestAge, { worker: "signing_key_deactivation" }),
        backlog.oldestAgeSeconds,
      );
      const counts = yield* Effect.forEach([0, 1, 2, 3], () => reconcile(), { concurrency: 2 });
      return counts.reduce<number>((sum, count) => sum + count, 0);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
