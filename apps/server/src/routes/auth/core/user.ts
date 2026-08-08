import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import { AccountService } from "@namera-ai/application";

import { enforceActor, toUserResponse } from "#/helpers/index";

export const UserRoutes = HttpApiBuilder.group(NameraApi, "user", (handlers) =>
  Effect.gen(function* () {
    const account = yield* AccountService;
    return handlers.handle("update", ({ payload }) =>
      Effect.gen(function* () {
        const actor = yield* CurrentActor;
        const data = yield* enforceActor({ actor, allowedActors: ["user"] });
        return toUserResponse(yield* account.updateUser(data.user.id, payload.metadata));
      }),
    );
  }),
);
