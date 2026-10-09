import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor } from "#/helpers/index";

const authorizeRead = Effect.gen(function* () {
  const actor = yield* CurrentActor;
  return yield* enforceActor({
    actor,
    allowedActors: ["user", "api-key", "cli"],
    requiredPermissions: { user: ["wallet:read"], "api-key": [], cli: ["wallet:read"] },
  });
});

export const PortfolioRoutes = HttpApiBuilder.group(NameraApi, "portfolio", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    return handlers.handle("query", ({ payload }) =>
      Effect.gen(function* () {
        yield* authorizeRead;
        return yield* app.data.portfolio.query(payload);
      }),
    );
  }),
);
