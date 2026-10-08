import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

import { enforceAdmin } from "#/middlewares/admin";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const BetaInviteRoutes = HttpApiBuilder.group(NameraApi, "betaInvite", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    return handlers
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          yield* enforceAdmin("invites:read");
          yield* consumeRateLimit("admin.reads", "operator", rateLimitPolicy.admin.readsGlobal);
          return yield* app.betaInvite.list(query);
        }),
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const admin = yield* enforceAdmin("invites:create");
          yield* consumeRateLimit("admin.writes", "operator", rateLimitPolicy.admin.writesGlobal);
          yield* consumeRateLimit(
            "admin.inviteCreate",
            "operator",
            rateLimitPolicy.admin.inviteCreateGlobal,
          );
          return yield* app.betaInvite.create(payload, admin.member.id);
        }),
      )
      .handle("revoke", ({ params }) =>
        Effect.gen(function* () {
          const admin = yield* enforceAdmin("invites:revoke");
          yield* consumeRateLimit("admin.writes", "operator", rateLimitPolicy.admin.writesGlobal);
          return yield* app.betaInvite.revoke(params.id, admin.member.id);
        }),
      );
  }),
);
