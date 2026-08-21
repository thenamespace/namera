import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import {
  WalletAssetsUnavailableError,
  WalletNotFoundError,
  type ActorId,
  type OrganizationId,
  type WalletId,
} from "@namera-ai/protocol";
import type { ListWalletAssetsRequest } from "@namera-ai/protocol/dto";

export const makeReadWallets = Effect.gen(function* () {
  const repository = yield* Repository;
  const evm = yield* Evm;

  const list = Effect.fn("application.wallet.list")(
    function* (input: { readonly organizationId: OrganizationId; readonly actorId?: ActorId }) {
      return yield* input.actorId === undefined
        ? repository.core.wallet.findForOrganization(input.organizationId)
        : repository.core.wallet.findForActor(input.organizationId, input.actorId);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const get = Effect.fn("application.wallet.get")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId?: ActorId;
      readonly walletId: WalletId;
    }) {
      const wallet = yield* input.actorId === undefined
        ? repository.core.wallet.findById(input.walletId, input.organizationId)
        : repository.core.wallet.findByIdForActor(
            input.walletId,
            input.organizationId,
            input.actorId,
          );
      if (wallet === undefined) {
        return yield* new WalletNotFoundError({ code: "WALLET_NOT_FOUND" });
      }
      return wallet;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const listAssets = Effect.fn("application.wallet.listAssets")(function* (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly walletId: WalletId;
    readonly request: ListWalletAssetsRequest;
  }) {
    const wallet = yield* get(input);

    return yield* evm.portfolio
      .getAssets({
        address: wallet.wallet.data.address,
        ...input.request,
      })
      .pipe(
        Effect.mapError(
          () => new WalletAssetsUnavailableError({ code: "WALLET_ASSETS_UNAVAILABLE" }),
        ),
      );
  });

  return { get, list, listAssets };
});
