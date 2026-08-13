import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceCurrentUser, toWalletResponse } from "#/helpers/index";

export const WalletRoutes = HttpApiBuilder.group(NameraApi, "wallet", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser(["wallet:create"]);
          return toWalletResponse(
            yield* app.wallet.create({
              organizationId: actor.organization.id,
              actorId: actor.actorId,
              request: payload,
            }),
          );
        }),
      )
      .handle("list", () =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser(["wallet:read"]);
          return (yield* app.wallet.list(actor.organization.id)).map(toWalletResponse);
        }),
      )
      .handle("get", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser(["wallet:read"]);
          return toWalletResponse(yield* app.wallet.get(actor.organization.id, params.walletId));
        }),
      );
  }),
);
