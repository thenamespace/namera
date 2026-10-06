import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";
import { Repository } from "@namera-ai/database";

import {
  AuthCookieConfig,
  clearAuthCookie,
  enforceActor,
  toSessionResponse,
} from "#/helpers/index";

export const SessionRoutes = HttpApiBuilder.group(NameraApi, "session", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    const repository = yield* Repository;
    const cookieConfig = yield* AuthCookieConfig;
    return handlers
      .handle("currentActor", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          if (actor.type === "user") return actor;
          // Resolve presentation data only here, never on every authorized request.
          const organization = yield* repository.auth.organization
            .findById(actor.data.organizationId)
            .pipe(Effect.orDie);
          const presentation = organization ? { organizationName: organization.metadata.name } : {};
          return actor.type === "api-key"
            ? { type: actor.type, data: { ...actor.data, ...presentation } }
            : { type: actor.type, data: { ...actor.data, ...presentation } };
        }),
      )
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
