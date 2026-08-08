import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import { AccountService } from "@namera-ai/application";

import { clearAuthCookie, enforceActor, toSessionResponse } from "#/helpers/index";

export const SessionRoutes = HttpApiBuilder.group(NameraApi, "session", (handlers) =>
  Effect.gen(function* () {
    const account = yield* AccountService;
    const actorData = Effect.gen(function* () {
      const actor = yield* CurrentActor;
      return yield* enforceActor({ actor, allowedActors: ["user"] });
    });

    return handlers
      .handle("currentUser", () => actorData)
      .handle("listSessions", () =>
        Effect.gen(function* () {
          const actor = yield* actorData;
          return (yield* account.listSessions(actor.user.id)).map(toSessionResponse);
        }),
      )
      .handle("logout", () =>
        Effect.gen(function* () {
          const actor = yield* actorData;
          yield* account.logout(actor.session.id, actor.user.id);
          yield* clearAuthCookie;
        }),
      )
      .handle("revokeOtherSessions", () =>
        Effect.gen(function* () {
          const actor = yield* actorData;
          return yield* account.revokeOtherSessions(actor.session.id, actor.user.id);
        }),
      );
  }),
);
