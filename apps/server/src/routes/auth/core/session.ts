import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import {
  AuthCookieConfig,
  clearAuthCookie,
  enforceActor,
  toSessionResponse,
} from "#/helpers/index";

export const SessionRoutes = HttpApiBuilder.group(NameraApi, "session", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    const cookieConfig = yield* AuthCookieConfig;
    return handlers
      .handle("currentActor", () => CurrentActor.pipe(Effect.map((actor) => actor)))
      .handle("currentUser", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          return yield* enforceActor({ actor, allowedActors: ["user"] });
        }),
      )
      .handle("listSessions", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          return (yield* app.session.list(data.user.id)).map(toSessionResponse);
        }),
      )
      .handle("logout", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          yield* app.session.logout(data.session.id, data.user.id);
          yield* clearAuthCookie(cookieConfig.secure);
        }),
      )
      .handle("revokeOtherSessions", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          return yield* app.session.revokeOthers(data.session.id, data.user.id);
        }),
      )
      .handle("revokeSession", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          const revoked = yield* app.session.revoke({
            sessionId: params.sessionId,
            currentSessionId: data.session.id,
            userId: data.user.id,
          });
          if (revoked && params.sessionId === data.session.id) {
            yield* clearAuthCookie(cookieConfig.secure);
          }
        }),
      );
  }),
);
