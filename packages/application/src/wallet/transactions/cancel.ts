import { DateTime, Effect } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { WalletTransactionError, type WalletOperationId } from "@namera-ai/protocol";

import { Audit } from "#/audit/layer";
import { lockOrganizationBilling } from "#/billing/lock";
import { makeBillingMetering } from "#/billing/metering";

import { walletTransactionView } from "./complete.js";
import type { WalletTransactionScope } from "./owner.js";

export const makeCancelWalletTransaction = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const billing = yield* makeBillingMetering;
  const audit = yield* Audit;
  return Effect.fn("application.wallet.transactions.cancel")(
    function* (scope: WalletTransactionScope & { readonly operationId: WalletOperationId }) {
      return yield* transaction.run(
        Effect.gen(function* () {
          yield* lockOrganizationBilling(repository, scope.organizationId);
          yield* repository.core.wallet.findByIdForUpdate(scope.walletId, scope.organizationId);
          const operationScope = { id: scope.operationId, organizationId: scope.organizationId };
          const operation = yield* repository.core.walletOperation.findById(operationScope);
          if (
            !operation ||
            operation.walletId !== scope.walletId ||
            operation.actorId !== scope.actorId
          )
            return yield* new WalletTransactionError({ code: "OPERATION_UNAVAILABLE" });
          if (operation.status === "cancelled") return walletTransactionView(operation);
          const cancelled = yield* repository.core.walletOperation.cancelUnsigned({
            ...operationScope,
            actorId: scope.actorId,
            now: yield* DateTime.now,
          });
          if (!cancelled)
            return yield* new WalletTransactionError({ code: "OPERATION_UNAVAILABLE" });
          const reservations = yield* repository.billing.usageReservation.listBySource(
            scope.organizationId,
            "wallet-operation",
            operation.id,
          );
          for (const reservation of reservations)
            yield* billing.release({
              organizationId: scope.organizationId,
              reservationId: reservation.id,
            });
          yield* audit.organization({
            organizationId: scope.organizationId,
            actorId: scope.actorId,
            event: "wallet.operation_cancelled",
            resourceType: "wallet",
            resourceId: scope.walletId,
            data: { version: 1, operationId: operation.id, kind: operation.kind },
          });
          return walletTransactionView(cancelled);
        }),
      );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
