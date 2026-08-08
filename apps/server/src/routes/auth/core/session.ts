import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { clearAuthCookie, enforceCurrentUser, toSessionResponse } from "#/helpers/index";

export const SessionRoutes = HttpApiBuilder.group(NameraApi, "session", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    return handlers
      .handle("currentUser", () => enforceCurrentUser())
      .handle("listSessions", () =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          return (yield* app.session.list(actor.user.id)).map(toSessionResponse);
        }),
      )
      .handle("logout", () =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          yield* app.session.logout(actor.session.id, actor.user.id);
          yield* clearAuthCookie;
        }),
      )
      .handle("revokeOtherSessions", () =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          return yield* app.session.revokeOthers(actor.session.id, actor.user.id);
        }),
      );
  }),
);
