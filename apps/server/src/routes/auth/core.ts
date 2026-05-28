import { Effect } from "effect";

import { HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, api } from "@namera-ai/api";
import { AuthConfig } from "@namera-ai/auth";
import { Database, Transaction } from "@namera-ai/database";
import * as AuthRepo from "@namera-ai/domain/auth";
import { mapToDatabaseError, mapToInternalError } from "@namera-ai/schema";

const currentUserHandler = Effect.fnUntraced(function* () {
  return yield* CurrentActor;
});

const listSessionsHandler = Effect.gen(function* () {
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
}).pipe(mapToDatabaseError, mapToInternalError);

const logoutHandler = Effect.gen(function* () {
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
}).pipe(mapToDatabaseError, mapToInternalError);

const revokeOtherSessionsHandler = Effect.gen(function* () {
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
}).pipe(mapToDatabaseError, mapToInternalError);

export const AuthCoreGroupLive = HttpApiBuilder.group(api, "auth", (handlers) =>
  handlers
    .handle("currentUser", currentUserHandler)
    .handle("listSessions", () => listSessionsHandler)
    .handle("logout", () => logoutHandler)
    .handle("revokeOtherSessions", () => revokeOtherSessionsHandler),
);
