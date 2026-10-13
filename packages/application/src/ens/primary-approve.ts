import { DateTime, Duration, Effect, Result } from "effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as HexEncoding from "effect/encoding/Hex";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { Passkeys } from "@namera-ai/passkeys";
import { IdentityPrimaryError, type EnsLabel } from "@namera-ai/protocol";
import type { ApproveIdentityPrimaryRequest } from "@namera-ai/protocol/dto";
import type { WalletOperation } from "@namera-ai/protocol/model";
import { generateUniqueId } from "@namera-ai/utils";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import { makeBillingMetering } from "#/billing/metering";
import { makeLoadOneClawOwner } from "#/oneclaw/owner";

import { toEnsName } from "./data.js";
import { makePrimaryOwner, primaryFailure, type PrimaryScope } from "./primary-owner.js";

export const primaryOperationView = (
  operation: WalletOperation,
  actorId: PrimaryScope["actorId"],
) => ({
  operationId: operation.id,
  name: operation.data.name,
  status: operation.status,
  transactionHash: operation.transactionHash,
  retryKey:
    operation.status === "awaiting-signature" && operation.actorId === actorId
      ? operation.idempotencyKey
      : null,
});

export const makeApproveIdentityPrimary = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const evm = yield* Evm;
  const passkeys = yield* Passkeys;
  const config = yield* AuthConfig;
  const owners = yield* makePrimaryOwner;
  const loadSigner = yield* makeLoadOneClawOwner;
  const billing = yield* makeBillingMetering;
  const audit = yield* Audit;
  return Effect.fn("application.ens.approvePrimary")(
    function* (
      scope: PrimaryScope & {
        readonly label: EnsLabel;
        readonly request: ApproveIdentityPrimaryRequest;
      },
    ) {
      const operationScope = {
        id: scope.request.operationId,
        organizationId: scope.organizationId,
      };
      const operation = yield* repository.core.walletOperation.findById(operationScope);
      if (
        !operation ||
        operation.walletId !== scope.walletId ||
        operation.actorId !== scope.actorId ||
        operation.data.name !== toEnsName(scope.label)
      )
        return yield* new IdentityPrimaryError({ code: "OPERATION_UNAVAILABLE" });
      if (["signed", "submitted", "confirmed", "failed"].includes(operation.status))
        return primaryOperationView(operation, scope.actorId);
      if (operation.status !== "awaiting-signature")
        return yield* new IdentityPrimaryError({ code: "APPROVAL_EXPIRED" });
      const leaseToken = generateUniqueId();
      const owner = yield* Effect.acquireRelease(
        transaction.run(
          Effect.gen(function* () {
            yield* repository.core.wallet.findByIdForUpdate(scope.walletId, scope.organizationId);
            const current = yield* owners.check(operation);
            const now = yield* DateTime.now;
            const claimed = yield* repository.core.walletOperation.claimForSigning({
              ...operationScope,
              actorId: scope.actorId,
              now,
              leaseToken,
              leaseExpiresAt: DateTime.addDuration(now, Duration.minutes(2)),
            });
            if (!claimed) return yield* new IdentityPrimaryError({ code: "OPERATION_BUSY" });
            return current;
          }),
        ),
        () =>
          repository.core.walletOperation
            .releaseSigningLease({ ...operationScope, leaseToken })
            .pipe(Effect.orDie),
      );
      yield* owners.checkCall(operation);
      const status = yield* evm.identity.status(
        operation.data.name,
        owner.wallet.wallet.data.address,
      );
      if (status.forwardAddress?.toLowerCase() !== owner.wallet.wallet.data.address.toLowerCase())
        return yield* new IdentityPrimaryError({ code: "FORWARD_MISMATCH" });
      const result = yield* Effect.gen(function* () {
        if (owner.type === "1claw") {
          if (scope.request.response)
            return yield* new IdentityPrimaryError({ code: "APPROVAL_INVALID" });
          const signer = yield* loadSigner(owner.wallet).pipe(
            Effect.mapError(() => new IdentityPrimaryError({ code: "OWNER_UNAVAILABLE" })),
          );
          const signed = yield* evm.execution
            .sign({
              account: {
                wallet: owner.wallet.wallet.data,
                owner: { validatorType: "ecdsa_secp256k1", account: signer },
              },
              prepared: operation.data.prepared,
            })
            .pipe(Effect.timeout(Duration.seconds(90)), Effect.mapError(primaryFailure));
          return { signed, assertion: undefined };
        }
        if (!scope.request.response)
          return yield* new IdentityPrimaryError({ code: "APPROVAL_INVALID" });
        const challenge = yield* evm.execution
          .ownerApprovalChallenge({ account: owner.account, prepared: operation.data.prepared })
          .pipe(Effect.mapError(primaryFailure));
        const assertion = yield* passkeys
          .verifyAuthentication({
            response: scope.request.response,
            expectedChallenge: Base64Url.encode(
              Result.getOrThrow(HexEncoding.decode(challenge.slice(2))),
            ),
            expectedOrigin: config.dashboardPublicOrigin.origin,
            expectedRpId: owner.credential.rpId,
            credentialId: owner.credential.credentialId,
            publicKeyHex: owner.wallet.signingKey.publicKeyHex,
            signCount: owner.credential.signCount,
          })
          .pipe(Effect.mapError(() => new IdentityPrimaryError({ code: "APPROVAL_INVALID" })));
        const signed = yield* evm.execution
          .completeOwnerApproval({
            account: owner.account,
            prepared: operation.data.prepared,
            assertion,
          })
          .pipe(Effect.mapError(() => new IdentityPrimaryError({ code: "APPROVAL_INVALID" })));
        return { signed, assertion };
      });
      const committed = yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.core.wallet.findByIdForUpdate(scope.walletId, scope.organizationId);
          yield* owners.check(operation);
          if (owner.type === "passkey" && result.assertion) {
            const advanced = yield* repository.core.signingKey.advancePasskeyCounter({
              id: owner.wallet.signingKey.id,
              organizationId: scope.organizationId,
              credentialId: owner.credential.credentialId,
              expectedCounter: owner.credential.signCount,
              nextCounter: result.assertion.signCount,
            });
            if (!advanced) return yield* new IdentityPrimaryError({ code: "APPROVAL_INVALID" });
          }
          const now = yield* DateTime.now;
          const accepted = yield* repository.core.walletOperation.acceptSignature({
            ...operationScope,
            actorId: scope.actorId,
            requestHash: operation.requestHash,
            signed: result.signed,
            now,
            leaseToken: generateUniqueId(),
            leaseExpiresAt: DateTime.addDuration(now, Duration.seconds(1)),
            signingLeaseToken: leaseToken,
          });
          if (!accepted) return yield* new IdentityPrimaryError({ code: "APPROVAL_EXPIRED" });
          yield* billing.reserve({
            organizationId: scope.organizationId,
            sourceType: "wallet-operation",
            sourceId: operation.id,
            expiresAt: DateTime.addDuration(now, Duration.hours(24)),
            meterKey: result.signed.billing.executionMeter,
            amount: 1n,
          });
          yield* audit.organization({
            organizationId: scope.organizationId,
            actorId: scope.actorId,
            event: "wallet.operation_approved",
            resourceType: "wallet",
            resourceId: scope.walletId,
            data: { version: 1, operationId: operation.id, kind: operation.kind },
          });
          return accepted;
        }),
      );
      return primaryOperationView(committed, scope.actorId);
    },
    Effect.scoped,
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
