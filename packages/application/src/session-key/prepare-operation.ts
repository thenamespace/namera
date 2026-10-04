import { DateTime, Duration, Effect, Metric, Result, Schema } from "effect";
import * as HexEncoding from "effect/encoding/Hex";

import { CryptoService } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { Passkeys } from "@namera-ai/passkeys";
import { SessionKeyOperationError, type ActorId, type OrganizationId } from "@namera-ai/protocol";
import {
  PasskeyAuthenticationOptions,
  type PrepareSessionKeyOperationRequest,
  type PrepareSessionKeyOperationResponse,
} from "@namera-ai/protocol/dto";
import type { SessionKeyOperation } from "@namera-ai/protocol/model";
import { sessionKeyOperationResults, sessionKeyOperationDuration } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";

import { makeLoadSessionOperationOwner } from "./operation-owner.js";

export const makePrepareSessionKeyOperation = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const crypto = yield* CryptoService;
  const passkeys = yield* Passkeys;
  const evm = yield* Evm;
  const audit = yield* Audit;
  const config = yield* AuthConfig;
  const loadOwner = yield* makeLoadSessionOperationOwner;

  return Effect.fn("application.sessionKey.prepareOperation")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly request: PrepareSessionKeyOperationRequest;
    }) {
      const owner = yield* loadOwner({
        organizationId: input.organizationId,
        installationId: input.request.installationId,
      });
      const requestHash = yield* crypto.hash({
        purpose: "session-key.owner-operation",
        value: JSON.stringify({
          installationId: owner.installation.id,
          configurationHash: owner.installation.configurationHash,
          kind: input.request.kind,
          sponsor: input.request.sponsor,
        }),
      });
      const scope = {
        organizationId: input.organizationId,
        actorId: input.actorId,
        idempotencyKey: input.request.idempotencyKey,
      };
      const responseFor = Effect.fnUntraced(function* (operation: SessionKeyOperation) {
        if (operation.requestHash !== requestHash)
          return yield* new SessionKeyOperationError({ code: "IDEMPOTENCY_CONFLICT" });
        const now = yield* DateTime.now;
        if (operation.status !== "awaiting-signature")
          return yield* new SessionKeyOperationError({ code: "INVALID_TRANSITION" });
        if (DateTime.toEpochMillis(operation.expiresAt) <= DateTime.toEpochMillis(now))
          return yield* new SessionKeyOperationError({ code: "APPROVAL_EXPIRED" });
        const challenge = yield* evm.execution
          .ownerApprovalChallenge({ account: owner.account, prepared: operation.data.prepared })
          .pipe(
            Effect.mapError(
              (error) =>
                new SessionKeyOperationError({
                  code:
                    "code" in error && error.code === "NETWORK_PAUSED"
                      ? "NETWORK_PAUSED"
                      : "PREPARATION_FAILED",
                }),
            ),
          );
        const options = yield* passkeys
          .generateAuthenticationOptions({
            rpId: owner.credential.rpId,
            credentialId: owner.credential.credentialId,
            challenge: new Uint8Array(Result.getOrThrow(HexEncoding.decode(challenge.slice(2)))),
            timeoutMs: Math.min(
              Duration.toMillis(config.passkey.timeToLive),
              DateTime.toEpochMillis(operation.expiresAt) - DateTime.toEpochMillis(now),
            ),
          })
          .pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(PasskeyAuthenticationOptions)),
            Effect.mapError(() => new SessionKeyOperationError({ code: "PREPARATION_FAILED" })),
          );
        return {
          operationId: operation.id,
          namespace: "eip155" as const,
          options,
          prepared: operation.data.prepared,
          expiresAt: operation.expiresAt,
        } satisfies PrepareSessionKeyOperationResponse;
      });
      const previous =
        yield* repository.core.sessionKeyOperation.findByActorAndIdempotencyKey(scope);
      if (previous !== undefined) return yield* responseFor(previous);

      const assertTransition = Effect.fnUntraced(function* (current: typeof owner) {
        const install = input.request.kind === "install";
        const now = yield* DateTime.now;
        if (
          install
            ? !["pending", "active"].includes(current.session.status) ||
              !["pending", "failed"].includes(current.installation.status) ||
              current.installation.data.authorization.validUntil <= DateTime.toEpochSeconds(now)
            : current.session.status !== "revoking" ||
              !["installed", "revoking"].includes(current.installation.status)
        ) {
          return yield* new SessionKeyOperationError({ code: "INVALID_TRANSITION" });
        }
      });
      yield* assertTransition(owner);
      const prepared = yield* evm.sessions
        .prepareOperation({
          account: owner.account,
          chainId: owner.installation.chainId,
          installation: owner.installation.data,
          kind: input.request.kind,
          sponsorship: input.request.sponsor ? "alchemy-bso" : "none",
        })
        .pipe(
          Effect.mapError(
            (error) =>
              new SessionKeyOperationError({
                code:
                  "code" in error && error.code === "NETWORK_PAUSED"
                    ? "NETWORK_PAUSED"
                    : "PREPARATION_FAILED",
              }),
          ),
        );
      const persistedOperation = yield* transaction.run(
        Effect.gen(function* () {
          // Serialize owner nonces across every session on this wallet. No remote call holds this lock.
          const locked = yield* repository.core.wallet.findByIdForUpdate(
            owner.wallet.wallet.id,
            input.organizationId,
          );
          if (locked === undefined)
            return yield* new SessionKeyOperationError({ code: "OWNER_UNAVAILABLE" });
          const current = yield* loadOwner({
            organizationId: input.organizationId,
            installationId: input.request.installationId,
          });
          yield* assertTransition(current);
          const existing =
            yield* repository.core.sessionKeyOperation.findByActorAndIdempotencyKey(scope);
          if (existing !== undefined) return existing;
          const busy = yield* repository.core.sessionKeyOperation.findActiveForWalletChain({
            organizationId: input.organizationId,
            walletId: owner.wallet.wallet.id,
            chainId: owner.installation.chainId,
          });
          if (busy !== undefined)
            return yield* new SessionKeyOperationError({ code: "OPERATION_BUSY" });
          const { operation } = yield* repository.core.sessionKeyOperation.insert({
            ...scope,
            installationId: owner.installation.id,
            walletId: owner.wallet.wallet.id,
            chainId: owner.installation.chainId,
            kind: input.request.kind,
            requestHash,
            data: { version: 1, prepared, signed: null },
            expiresAt: DateTime.addDuration(yield* DateTime.now, config.passkey.timeToLive),
          });
          yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "session_key.operation_prepared",
            resourceType: "session-key",
            resourceId: owner.session.id,
            data: {
              version: 1,
              installationId: owner.installation.id,
              operationId: operation.id,
              chainId: operation.chainId,
              kind: operation.kind,
            },
          });
          yield* Metric.update(
            Metric.withAttributes(sessionKeyOperationResults, {
              stage: "prepare",
              result: "prepared",
            }),
            1,
          );
          return operation;
        }),
      );
      return yield* responseFor(persistedOperation);
    },
    Effect.trackDuration(Metric.withAttributes(sessionKeyOperationDuration, { stage: "prepare" })),
    Effect.tapErrorTag("SessionKeyOperationError", (error) =>
      Metric.update(
        Metric.withAttributes(sessionKeyOperationResults, { stage: "prepare", result: error.code }),
        1,
      ),
    ),
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
