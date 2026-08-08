import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthTokenSecurity, CurrentActor, NameraApi } from "@namera-ai/api";
import { AccountService, authPolicy } from "@namera-ai/application";

import { enforceActor, toSessionResponse } from "#/helpers/index";

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
          yield* HttpApiBuilder.securitySetCookie(AuthTokenSecurity, "", {
            path: authPolicy.cookie.path,
            httpOnly: authPolicy.cookie.httpOnly,
            secure: authPolicy.cookie.secure,
            sameSite: authPolicy.cookie.sameSite,
            maxAge: 0,
          });
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
