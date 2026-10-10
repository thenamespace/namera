import { Config, DateTime, Duration, Effect } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { SessionKeyOperationError } from "@namera-ai/protocol";
import type { SessionKeyOperation } from "@namera-ai/protocol/model";
import { generateUniqueId } from "@namera-ai/utils";

import { makeLoadOneClawOwner } from "#/oneclaw/owner";

import { makeLoadSessionOperationOwner } from "./operation-owner.js";

export const makeManagedSessionApproval = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const evm = yield* Evm;
  const loadOwner = yield* makeLoadSessionOperationOwner;
  const loadSigner = yield* makeLoadOneClawOwner;

  const check = Effect.fnUntraced(function* (operation: SessionKeyOperation) {
    const owner = yield* loadOwner({
      organizationId: operation.organizationId,
      installationId: operation.installationId,
    });
    const [member] = yield* repository.auth.member.findByActorIds(operation.organizationId, [
      operation.actorId,
    ]);
    if (
      !member ||
      member.organizationMember.removedAt !== null ||
      !member.organizationRole.permissions.includes(
        operation.kind === "install" ? "session-key:create" : "session-key:revoke",
      )
    )
      return yield* new SessionKeyOperationError({ code: "OPERATION_UNAVAILABLE" });
    if (
      owner.type !== "1claw" ||
      operation.walletId !== owner.wallet.wallet.id ||
      operation.data.managedOwner?.signingKeyId !== owner.wallet.signingKey.id ||
      operation.data.managedOwner.publicKey !== owner.wallet.signingKey.publicKeyHex
    )
      return yield* new SessionKeyOperationError({ code: "OWNER_UNAVAILABLE" });
    const appId = yield* Config.String("ONECLAW_PLATFORM_APP_ID");
    const connection = yield* repository.core.providerConnections.findByOrganization(
      operation.organizationId,
      appId,
    );
    if (
      !connection ||
      connection.id !== owner.wallet.signingKey.providerConnectionId ||
      connection.status !== "ready"
    )
      return yield* new SessionKeyOperationError({ code: "OWNER_UNAVAILABLE" });
    const now = yield* DateTime.now;
    if (DateTime.toEpochMillis(operation.expiresAt) <= DateTime.toEpochMillis(now))
      return yield* new SessionKeyOperationError({ code: "APPROVAL_EXPIRED" });
    if (
      operation.kind === "install"
        ? !["pending", "active"].includes(owner.session.status) ||
          !["pending", "failed"].includes(owner.installation.status) ||
          owner.installation.data.authorization.validUntil <= DateTime.toEpochSeconds(now)
        : owner.session.status !== "revoking" ||
          !["installed", "revoking"].includes(owner.installation.status)
    )
      return yield* new SessionKeyOperationError({ code: "INVALID_TRANSITION" });

    // The EVM signer additionally verifies encoded calldata, sender, factory and gas
    // against this context. Never let a stored root operation become a generic signer.
    const prepared = operation.data.prepared;
    const [call] = prepared.context.calls;
    if (
      prepared.chainId !== owner.installation.chainId ||
      prepared.context.calls.length !== 1 ||
      call?.to.toLowerCase() !== owner.wallet.wallet.data.address.toLowerCase() ||
      call.value !== 0n ||
      call.data !==
        (operation.kind === "install"
          ? owner.installation.data.installCallData
          : owner.installation.data.uninstallCallData)
    )
      return yield* new SessionKeyOperationError({ code: "APPROVAL_INVALID" });
    return owner;
  });

  const sign = Effect.fnUntraced(function* (operation: SessionKeyOperation) {
    const scope = { id: operation.id, organizationId: operation.organizationId };
    const leaseToken = generateUniqueId();
    const owner = yield* Effect.acquireRelease(
      transaction.run(
        Effect.gen(function* () {
          yield* repository.core.wallet.findByIdForUpdate(
            operation.walletId,
            operation.organizationId,
          );
          const current = yield* check(operation).pipe(Effect.catchTag("ConfigError", Effect.die));
          const now = yield* DateTime.now;
          const claimed = yield* repository.core.sessionKeyOperation.claimForSigning({
            ...scope,
            actorId: operation.actorId,
            now,
            leaseToken,
            leaseExpiresAt: DateTime.addDuration(now, Duration.minutes(2)),
          });
          if (!claimed) return yield* new SessionKeyOperationError({ code: "OPERATION_BUSY" });
          return current;
        }),
      ),
      () =>
        repository.core.sessionKeyOperation
          .releaseSigningLease({ ...scope, leaseToken })
          .pipe(Effect.orDie),
    );
    const signer = yield* loadSigner(owner.wallet).pipe(
      Effect.mapError(() => new SessionKeyOperationError({ code: "OWNER_UNAVAILABLE" })),
    );
    const signed = yield* evm.execution
      .sign({
        account: {
          wallet: owner.wallet.wallet.data,
          owner: { validatorType: "ecdsa_secp256k1", account: signer },
        },
        prepared: operation.data.prepared,
      })
      .pipe(
        Effect.timeout(Duration.seconds(90)),
        Effect.mapError(
          (error) =>
            new SessionKeyOperationError({
              code:
                "code" in error && error.code === "NETWORK_PAUSED"
                  ? "NETWORK_PAUSED"
                  : "APPROVAL_INVALID",
            }),
        ),
      );
    return { signed, leaseToken };
  });
  return { check, sign };
});
