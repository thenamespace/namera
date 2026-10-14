import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { WalletTransactionError, type WalletOperationId } from "@namera-ai/protocol";

import { makeCancelWalletTransaction } from "./cancel.js";
import { makeCompleteWalletTransaction, walletTransactionView } from "./complete.js";
import { makeTransactionOwner, type WalletTransactionScope } from "./owner.js";
import { makePrepareWalletTransaction } from "./prepare.js";
import { makeReconcileWalletTransactions } from "./reconcile.js";

export const makeWalletTransactions = Effect.gen(function* () {
  const repository = yield* Repository;
  const owners = yield* makeTransactionOwner;
  const prepare = yield* makePrepareWalletTransaction;
  const cancel = yield* makeCancelWalletTransaction;
  const complete = yield* makeCompleteWalletTransaction;
  const reconcile = yield* makeReconcileWalletTransactions;
  const get = Effect.fn("application.wallet.transactions.get")(
    function* (scope: WalletTransactionScope & { readonly operationId: WalletOperationId }) {
      yield* owners.load(scope);
      const operation = yield* repository.core.walletOperation.findById({
        id: scope.operationId,
        organizationId: scope.organizationId,
      });
      if (
        !operation ||
        operation.walletId !== scope.walletId ||
        operation.actorId !== scope.actorId
      )
        return yield* new WalletTransactionError({ code: "OPERATION_UNAVAILABLE" });
      return walletTransactionView(operation);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
  return { prepare, complete, cancel, get, reconcile };
});
