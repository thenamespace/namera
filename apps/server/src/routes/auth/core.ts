import { Effect } from "effect";

import { HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, api } from "@namera-ai/api";
import { AuthConfig } from "@namera-ai/auth";
import { Database, Transaction } from "@namera-ai/database";
import * as AuthRepo from "@namera-ai/domain/auth";
import { mapToDatabaseError, mapToInternalError } from "@namera-ai/schema";

const currentUserHandler = Effect.fn("auth.currentUser")(function* () {
  return yield* CurrentActor;
});

const listSessionsHandler = Effect.fn("auth.listSessions")(
  function* () {
    const user = (yield* CurrentActor).user;
    const authRepo = yield* AuthRepo.AuthRepo;
    const db = yield* Database.Database;

    const sessions = yield* db.transaction((tx) =>
      Effect.gen(function* () {
        yield* Transaction.setActorContext({
          actorType: "user",
          userId: user.id,
        });
        return yield* authRepo.session.findSessionsForUserId(user.id);
      }).pipe(Transaction.withTx(tx)),
    );

    return sessions.map(({ token: _t, ...session }) => {
      return session;
    });
  },
  mapToDatabaseError,
  mapToInternalError,
);

const logoutHandler = Effect.fn("auth.logout")(
  function* () {
    const authUser = yield* CurrentActor;
    const authConfig = yield* AuthConfig.AuthConfig;
    const authRepo = yield* AuthRepo.AuthRepo;
    const db = yield* Database.Database;

    yield* db.transaction((tx) =>
      Effect.gen(function* () {
        yield* Transaction.setActorContext({
          actorType: "user",
          userId: authUser.user.id,
        });
        return yield* authRepo.session.revokeSession(authUser.session.id);
      }).pipe(Transaction.withTx(tx)),
    );

    return yield* HttpServerResponse.empty({ status: 200 })
      .pipe(
        HttpServerResponse.expireCookie(
          authConfig.session.cookieName,
          authConfig.session.cookieOpts,
        ),
      )
      .pipe(Effect.orDie);
  },
  mapToDatabaseError,
  mapToInternalError,
);

const revokeOtherSessionsHandler = Effect.fn("auth.revokeOtherSessions")(
  function* () {
    const authUser = yield* CurrentActor;
    const authRepo = yield* AuthRepo.AuthRepo;
    const db = yield* Database.Database;

    const revokedSessions = yield* db.transaction((tx) =>
      Effect.gen(function* () {
        return yield* authRepo.session.revokeAllSessionsExcept(
          authUser.user.id,
          authUser.session.id,
        );
      }).pipe(Transaction.withTx(tx)),
    );

    return revokedSessions.length;
  },
  mapToDatabaseError,
  mapToInternalError,
);

export const AuthCoreGroupLive = HttpApiBuilder.group(api, "auth", (handlers) =>
  handlers
    .handle("currentUser", currentUserHandler)
    .handle("listSessions", () => listSessionsHandler())
    .handle("logout", () => logoutHandler())
    .handle("revokeOtherSessions", () => revokeOtherSessionsHandler()),
);
