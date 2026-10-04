import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor } from "#/helpers/index";

export const DashboardRoutes = HttpApiBuilder.group(NameraApi, "dashboard", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers.handle("getOverview", () =>
      Effect.gen(function* () {
        const actor = yield* CurrentActor;
        const data = yield* enforceActor({
          actor,
          allowedActors: ["user"],
          requiredPermissions: {
            user: ["wallet:read", "session-key:read", "execution:read", "billing:read"],
          },
        });
        return yield* app.dashboardOverview.get(data.organization.id);
      }),
    );
  }),
);
