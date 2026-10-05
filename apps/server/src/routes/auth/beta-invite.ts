import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const BetaInviteRoutes = HttpApiBuilder.group(NameraApi, "betaInvite", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    return handlers
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          yield* consumeRateLimit("admin.reads", "operator", rateLimitPolicy.admin.readsGlobal);
          return yield* app.betaInvite.list(query);
        }),
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          yield* consumeRateLimit("admin.writes", "operator", rateLimitPolicy.admin.writesGlobal);
          yield* consumeRateLimit(
            "admin.inviteCreate",
            "operator",
            rateLimitPolicy.admin.inviteCreateGlobal,
          );
          return yield* app.betaInvite.create(payload);
        }),
      )
      .handle("revoke", ({ params }) =>
        Effect.gen(function* () {
          yield* consumeRateLimit("admin.writes", "operator", rateLimitPolicy.admin.writesGlobal);
          return yield* app.betaInvite.revoke(params.id);
        }),
      );
  }),
);
