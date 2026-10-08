import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentAdmin, NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

export const AdminOverviewRoutes = HttpApiBuilder.group(NameraApi, "adminOverview", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    return handlers.handle("get", ({ query }) =>
      Effect.gen(function* () {
        return yield* app.adminOverview.get(yield* CurrentAdmin, query.period);
      }),
    );
  }),
);
