import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceCurrentUser, toUserResponse } from "#/helpers/index";

export const UserRoutes = HttpApiBuilder.group(NameraApi, "user", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    return handlers.handle("update", ({ payload }) =>
      Effect.gen(function* () {
        const data = yield* enforceCurrentUser();
        return toUserResponse(
          yield* app.user.update(data.user.id, data.session.id, payload.metadata),
        );
      }),
    );
  }),
);
