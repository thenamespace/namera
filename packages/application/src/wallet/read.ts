import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import {
  PortfolioUnavailableError,
  WalletNotFoundError,
  type ActorId,
  type OrganizationId,
  type WalletId,
} from "@namera-ai/protocol";
import type { GetWalletPortfolioRequest } from "@namera-ai/protocol/dto";

import type { DataApplication } from "#/data/index";

export const makeReadWallets = (data: DataApplication) =>
  Effect.gen(function* () {
    const repository = yield* Repository;

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

    const getPortfolio = Effect.fn("application.wallet.getPortfolio")(function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId?: ActorId;
      readonly walletId: WalletId;
      readonly request: GetWalletPortfolioRequest;
    }) {
      const wallet = yield* get(input);

      return yield* data.portfolio
        .query({
          namespace: "eip155",
          address: wallet.wallet.data.address,
          ...input.request,
        })
        .pipe(
          Effect.mapError(() => new PortfolioUnavailableError({ code: "PORTFOLIO_UNAVAILABLE" })),
        );
    });

    return { get, list, getPortfolio };
  });
