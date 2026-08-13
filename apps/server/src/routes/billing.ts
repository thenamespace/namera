import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceCurrentUser } from "#/helpers/index";

export const BillingRoutes = HttpApiBuilder.group(NameraApi, "billing", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers.handle("get", () =>
      Effect.gen(function* () {
        const actor = yield* enforceCurrentUser(["billing:read"]);
        return yield* app.billing.get(actor.organization.id);
      }),
    );
  }),
);
