import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { clearAuthCookie, enforceActor, toSessionResponse } from "#/helpers/index";

export const SessionRoutes = HttpApiBuilder.group(NameraApi, "session", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    const actorData = Effect.gen(function* () {
      const actor = yield* CurrentActor;
      return yield* enforceActor({ actor, allowedActors: ["user"] });
    });

    return handlers
      .handle("currentUser", () => actorData)
      .handle("listSessions", () =>
        Effect.gen(function* () {
          const actor = yield* actorData;
          return (yield* app.session.list(actor.user.id)).map(toSessionResponse);
        }),
      )
      .handle("logout", () =>
        Effect.gen(function* () {
          const actor = yield* actorData;
          yield* app.session.logout(actor.session.id, actor.user.id);
          yield* clearAuthCookie;
        }),
      )
      .handle("revokeOtherSessions", () =>
        Effect.gen(function* () {
          const actor = yield* actorData;
          return yield* app.session.revokeOthers(actor.session.id, actor.user.id);
        }),
      );
  }),
);
