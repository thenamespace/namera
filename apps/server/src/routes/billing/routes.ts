import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor } from "#/helpers/index";

export const BillingRoutes = HttpApiBuilder.group(NameraApi, "billing", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers.handle("get", () =>
      Effect.gen(function* () {
        const actor = yield* CurrentActor;
        const data = yield* enforceActor({
          actor,
          allowedActors: ["user"],
          requiredPermissions: { user: ["billing:read"] },
        });
        return yield* app.billing.get(data.organization.id);
      }),
    );
  }),
);
