import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor, toActorReadScope, toWalletResponse } from "#/helpers/index";

export const WalletRoutes = HttpApiBuilder.group(NameraApi, "wallet", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["wallet:create"] },
          });
          return toWalletResponse(
            yield* app.wallet.create({
              organizationId: data.organization.id,
              actorId: data.actorId,
              request: payload,
            }),
          );
        }),
      )
      .handle("list", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user", "api-key", "cli"],
            requiredPermissions: { user: ["wallet:read"], "api-key": [], cli: ["wallet:read"] },
          });
          return (yield* app.wallet.list(toActorReadScope(data))).map(toWalletResponse);
        }),
      )
      .handle("get", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user", "api-key", "cli"],
            requiredPermissions: { user: ["wallet:read"], "api-key": [], cli: ["wallet:read"] },
          });
          return toWalletResponse(
            yield* app.wallet.get({ ...toActorReadScope(data), walletId: params.walletId }),
          );
        }),
      )
      .handle("listAssets", ({ params, query }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user", "api-key", "cli"],
            requiredPermissions: { user: ["wallet:read"], "api-key": [], cli: ["wallet:read"] },
          });
          return yield* app.wallet.listAssets({
            ...toActorReadScope(data),
            walletId: params.walletId,
            request: query,
          });
        }),
      )
      .handle("update", ({ params, payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["wallet:update"] },
          });
          return toWalletResponse(
            yield* app.wallet.update({
              organizationId: data.organization.id,
              actorId: data.actorId,
              walletId: params.walletId,
              request: payload,
            }),
          );
        }),
      );
  }),
);
