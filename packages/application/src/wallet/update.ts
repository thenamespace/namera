import { Effect, Equal, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import {
  WalletNotFoundError,
  type ActorId,
  type OrganizationId,
  type WalletId,
} from "@namera-ai/protocol";
import type { UpdateWalletRequest } from "@namera-ai/protocol/dto";
import { walletMetadataUpdates } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";

export const makeUpdateWallet = Effect.gen(function* () {
  const audit = yield* Audit;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;

  return Effect.fn("application.wallet.update")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly walletId: WalletId;
      readonly request: UpdateWalletRequest;
    }) {
      const result = yield* transaction.run(
        Effect.gen(function* () {
          const current = yield* repository.core.wallet.findById(
            input.walletId,
            input.organizationId,
          );
          if (current === undefined) {
            return yield* new WalletNotFoundError({ code: "WALLET_NOT_FOUND" });
          }
          if (Equal.equals(current.wallet.metadata, input.request.metadata)) {
            return { wallet: current, changed: false } as const;
          }
          const wallet = yield* repository.core.wallet.updateMetadata(
            input.walletId,
            input.organizationId,
            input.request.metadata,
          );
          if (wallet === undefined) {
            return yield* new WalletNotFoundError({ code: "WALLET_NOT_FOUND" });
          }
          yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "wallet.updated",
            resourceType: "wallet",
            resourceId: wallet.wallet.id,
            data: { version: 1, changedFields: ["metadata"] },
          });
          return { wallet, changed: true } as const;
        }),
      );
      if (result.changed) {
        yield* Metric.update(walletMetadataUpdates, 1);
        yield* Effect.logInfo("wallet.updated");
      }
      return result.wallet;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
