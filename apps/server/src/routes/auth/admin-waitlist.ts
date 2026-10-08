import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentAdmin, NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const AdminWaitlistRoutes = HttpApiBuilder.group(NameraApi, "adminWaitlist", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    return handlers
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          return yield* app.waitlist.list(yield* CurrentAdmin, query);
        }),
      )
      .handle("accept", ({ params }) =>
        Effect.gen(function* () {
          const admin = yield* CurrentAdmin;
          yield* consumeRateLimit(
            "admin.waitlist.write",
            admin.member.id,
            rateLimitPolicy.admin.writesGlobal,
          );
          return yield* app.waitlist.accept(admin, params.id);
        }),
      );
  }),
);
