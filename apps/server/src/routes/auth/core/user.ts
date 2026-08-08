import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor, toUserResponse } from "#/helpers/index";

export const UserRoutes = HttpApiBuilder.group(NameraApi, "user", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    return handlers.handle("update", ({ payload }) =>
      Effect.gen(function* () {
        const actor = yield* CurrentActor;
        const data = yield* enforceActor({ actor, allowedActors: ["user"] });
        return toUserResponse(yield* app.user.update(data.user.id, payload.metadata));
      }),
    );
  }),
);
