import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const AdminUserRoutes = HttpApiBuilder.group(NameraApi, "adminUser", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    return handlers.handle("list", ({ query }) =>
      Effect.gen(function* () {
        yield* consumeRateLimit("admin.reads", "operator", rateLimitPolicy.admin.readsGlobal);
        return yield* app.admin.listUsers(query);
      }),
    );
  }),
);
