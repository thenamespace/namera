import { DateTime, Duration, Effect, Result } from "effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as HexEncoding from "effect/encoding/Hex";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { Passkeys } from "@namera-ai/passkeys";
import { WalletTransactionError } from "@namera-ai/protocol";
import type { CompleteWalletTransactionRequest } from "@namera-ai/protocol/dto";
import type { WalletOperation } from "@namera-ai/protocol/model";
import { generateUniqueId } from "@namera-ai/utils";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import { lockOrganizationBilling } from "#/billing/lock";
import { makeBillingMetering } from "#/billing/metering";
import { makeLoadOneClawOwner } from "#/oneclaw/owner";

import { makeTransactionOwner, transactionFailure, type WalletTransactionScope } from "./owner.js";
import { makeHashWalletTransaction } from "./request.js";

export const walletTransactionView = (operation: WalletOperation) => ({
  namespace: "eip155" as const,
  operationId: operation.id,
  status: operation.status,
  userOperationHash: operation.data.signed?.userOperationHash ?? null,
  transactionHash: operation.transactionHash,
  submissionBlocked:
    (operation.status === "signed" || operation.status === "submitted") &&
    (operation.data.submissionBlocked ?? false),
});
const completedView = (operation: WalletOperation) => {
  if (
    !operation.data.signed ||
    !["signed", "submitted", "confirmed", "failed"].includes(operation.status)
  )
    throw new Error("Completed wallet operation lacks its signed envelope");
  return {
    namespace: "eip155" as const,
    operationId: operation.id,
    status: operation.status as "signed" | "submitted" | "confirmed" | "failed",
    userOperationHash: operation.data.signed.userOperationHash,
  };
};

export const makeCompleteWalletTransaction = Effect.gen(function* () {
  const repository = yield* Repository;
  const hashWalletTransaction = yield* makeHashWalletTransaction;
  const transaction = yield* TransactionService;
  const evm = yield* Evm;
  const passkeys = yield* Passkeys;
  const config = yield* AuthConfig;
  const owners = yield* makeTransactionOwner;
  const loadSigner = yield* makeLoadOneClawOwner;
  const billing = yield* makeBillingMetering;
  const audit = yield* Audit;
  return Effect.fn("application.wallet.transactions.complete")(
    function* (
      scope: WalletTransactionScope & {
        readonly request: CompleteWalletTransactionRequest;
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
        operation.kind !== "transaction" ||
        operation.data.prepared.namespace !== scope.request.namespace
      )
        return yield* new WalletTransactionError({ code: "OPERATION_UNAVAILABLE" });
      yield* owners.load(scope);
      if (["signed", "submitted", "confirmed", "failed"].includes(operation.status))
        return completedView(operation);
      if (operation.status !== "awaiting-signature")
        return yield* new WalletTransactionError({ code: "APPROVAL_EXPIRED" });
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
            if (!claimed) return yield* new WalletTransactionError({ code: "OPERATION_BUSY" });
            return current;
          }),
        ),
        () =>
          repository.core.walletOperation
            .releaseSigningLease({ ...operationScope, leaseToken })
            .pipe(Effect.orDie),
      );
      const prepared = operation.data.prepared;
      const hash = yield* hashWalletTransaction(scope.walletId, {
        namespace: prepared.namespace,
        chainId: prepared.chainId,
        calls: prepared.context.calls,
        sponsor: prepared.sponsorship === "alchemy-bso",
      });
      if (hash !== operation.requestHash)
        return yield* new WalletTransactionError({ code: "APPROVAL_INVALID" });
      yield* evm.execution.checkFunding(prepared);
      const result = yield* Effect.gen(function* () {
        if (owner.type === "1claw") {
          if (scope.request.response)
            return yield* new WalletTransactionError({ code: "APPROVAL_INVALID" });
          const signer = yield* loadSigner(owner.wallet).pipe(
            Effect.mapError(() => new WalletTransactionError({ code: "OWNER_UNAVAILABLE" })),
          );
          const signed = yield* evm.execution
            .sign({
              account: {
                wallet: owner.wallet.wallet.data,
                owner: { validatorType: "ecdsa_secp256k1", account: signer },
              },
              prepared: operation.data.prepared,
            })
            .pipe(Effect.timeout(Duration.seconds(90)), Effect.mapError(transactionFailure));
          return { signed, assertion: undefined };
        }
        if (!scope.request.response)
          return yield* new WalletTransactionError({ code: "APPROVAL_INVALID" });
        const challenge = yield* evm.execution
          .ownerApprovalChallenge({ account: owner.account, prepared: operation.data.prepared })
          .pipe(Effect.mapError(transactionFailure));
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
          .pipe(Effect.mapError(() => new WalletTransactionError({ code: "APPROVAL_INVALID" })));
        const signed = yield* evm.execution
          .completeOwnerApproval({
            account: owner.account,
            prepared: operation.data.prepared,
            assertion,
          })
          .pipe(Effect.mapError(() => new WalletTransactionError({ code: "APPROVAL_INVALID" })));
        return { signed, assertion };
      });
      const committed = yield* transaction.run(
        Effect.gen(function* () {
          yield* lockOrganizationBilling(repository, scope.organizationId);
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
            if (!advanced) return yield* new WalletTransactionError({ code: "APPROVAL_INVALID" });
          }
          const now = yield* DateTime.now;
          if (operation.data.prepared.billing.sponsorship) {
            const holds = yield* repository.billing.usageReservation.listBySource(
              scope.organizationId,
              "wallet-operation",
              operation.id,
            );
            const gas = holds.find(
              (hold) => hold.meterKey === "gas-sponsorship" && hold.status === "active",
            );
            if (
              !gas ||
              gas.amount !== operation.data.prepared.billing.sponsorship.reservationAmountMicroUsd
            )
              return yield* new WalletTransactionError({ code: "APPROVAL_EXPIRED" });
          }
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
          if (!accepted) return yield* new WalletTransactionError({ code: "APPROVAL_EXPIRED" });
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
      return completedView(committed);
    },
    Effect.scoped,
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
