import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentAdmin, NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

const writer = Effect.gen(function* () {
  const admin = yield* CurrentAdmin;
  yield* consumeRateLimit(
    "admin.invites.write",
    admin.member.id,
    rateLimitPolicy.admin.writesGlobal,
  );
  return admin;
});

export const BetaInviteRoutes = HttpApiBuilder.group(NameraApi, "betaInvite", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    return handlers
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          return yield* app.betaInvite.list(yield* CurrentAdmin, query);
        }),
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          return yield* app.betaInvite.create(yield* writer, payload);
        }),
      )
      .handle("revoke", ({ params }) =>
        Effect.gen(function* () {
          return yield* app.betaInvite.revoke(yield* writer, params.id);
        }),
      );
  }),
);
