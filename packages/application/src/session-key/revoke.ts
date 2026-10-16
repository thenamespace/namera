import { DateTime, Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { ManagementPermissionDeniedError } from "@namera-ai/protocol";
import {
  SessionKeyNotFoundError,
  type ActorId,
  type OrganizationId,
  type SessionKeyId,
} from "@namera-ai/protocol";
import { sessionKeyRevocationDuration, sessionKeyRevocationResults } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";
import { makeCheckManagementAuthority } from "#/auth/core/management-authority";

import { makeFinishSessionKeyRevocation } from "./finish-revocation.js";
import { makeLoadSessionKeyViews } from "./view.js";

export const makeRevokeSessionKey = Effect.gen(function* () {
  const audit = yield* Audit;
  const repository = yield* Repository;
  const checkAuthority = yield* makeCheckManagementAuthority;
  const transaction = yield* TransactionService;
  const finish = yield* makeFinishSessionKeyRevocation;
  const loadViews = yield* makeLoadSessionKeyViews;

  return Effect.fn("application.sessionKey.revoke")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly sessionKeyId: SessionKeyId;
    }) {
      const result = yield* transaction.run(
        Effect.gen(function* () {
          if (!(yield* checkAuthority({ ...input, permission: "session-key:revoke" })))
            return yield* new ManagementPermissionDeniedError({
              code: "MANAGEMENT_PERMISSION_DENIED",
            });
          const existing = yield* repository.core.sessionKey.findById(
            input.sessionKeyId,
            input.organizationId,
          );
          if (existing === undefined)
            return yield* new SessionKeyNotFoundError({ code: "SESSION_KEY_NOT_FOUND" });
          yield* repository.core.wallet.findByIdForUpdate(existing.walletId, input.organizationId);
          const now = yield* DateTime.now;
          const revoking = yield* repository.core.sessionKey.beginRevocation(
            input.sessionKeyId,
            input.organizationId,
            input.actorId,
            now,
          );
          if (revoking !== undefined) {
            const grants = yield* repository.core.sessionKeyGrant.revokeActiveForSessionKey(
              input.organizationId,
              input.sessionKeyId,
              input.actorId,
              now,
            );
            yield* repository.core.sessionKeyOperation.cancelUnsignedForSession({ ...input, now });
            yield* audit.organization({
              organizationId: input.organizationId,
              actorId: input.actorId,
              event: "session_key.revocation_requested",
              resourceType: "session-key",
              resourceId: revoking.id,
              data: {
                version: 1,
                walletId: revoking.walletId,
                namespace: revoking.namespace,
                revokedGrantCount: grants.length,
              },
            });
          }
          const session =
            revoking ??
            (yield* repository.core.sessionKey.findById(input.sessionKeyId, input.organizationId));
          if (session?.status === "revoking" || session?.status === "revoked") {
            const signer = yield* repository.core.signingKey.findById(
              session.signingKeyId,
              input.organizationId,
            );
            if (!signer) return yield* Effect.die("Revoking session has no signer");
            if (signer.data.type === "1claw") {
              yield* repository.core.signingKey.setStatus(
                signer.id,
                input.organizationId,
                "disabled",
              );
              const job = yield* repository.jobs.signingKeyDeactivation.enqueue({
                organizationId: input.organizationId,
                signingKeyId: signer.id,
              });
              if (job)
                yield* audit.organization({
                  organizationId: input.organizationId,
                  actorId: input.actorId,
                  event: "signing_key.deactivation_requested",
                  resourceType: "signing-key",
                  resourceId: signer.id,
                  data: { version: 1, provider: "1claw" },
                });
            }
          }
          // Unsigned registrations can finish immediately. Signed attempts must be
          // reconciled even after API grants disappear; a server timeout cannot cancel them.
          const finished = yield* finish(input);
          const sessionKey =
            finished ??
            (yield* repository.core.sessionKey.findById(input.sessionKeyId, input.organizationId));
          if (sessionKey === undefined)
            return yield* Effect.die("Session disappeared during revocation");
          return { sessionKey, changed: revoking !== undefined || finished !== undefined };
        }),
      );
      yield* Metric.update(
        Metric.withAttributes(sessionKeyRevocationResults, {
          result: result.changed ? result.sessionKey.status : "unchanged",
        }),
        1,
      );
      const [view] = yield* loadViews(input.organizationId, [result.sessionKey]);
      if (view === undefined) return yield* Effect.die("Revoked session key could not be loaded");
      return view;
    },
    Effect.trackDuration(sessionKeyRevocationDuration),
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
