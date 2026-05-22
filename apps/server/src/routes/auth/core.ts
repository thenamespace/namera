import { Effect } from "effect";

import { HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthenticatedUser, api } from "@namera-ai/api";
import { AuthConfig } from "@namera-ai/auth";
import { AdminDatabase, Transaction } from "@namera-ai/database";
import * as AuthRepo from "@namera-ai/domain/auth";
import { mapDatabaseError } from "@namera-ai/schema";

const currentUserHandler = Effect.fnUntraced(function* () {
  return yield* AuthenticatedUser;
});

const listSessionsHandler = Effect.gen(function* () {
  const user = (yield* AuthenticatedUser).user;
  const authRepo = yield* AuthRepo.AuthRepo;
  const db = yield* AdminDatabase.AdminDatabase;

  const sessions = yield* db.transaction((tx) =>
    Effect.gen(function* () {
      return yield* authRepo.session.findSessionsForUserId(user.id);
    }).pipe(Transaction.withTx(tx)),
  );

  return sessions.map(({ token: _t, ...session }) => {
    return session;
  });
}).pipe(mapDatabaseError);

const logoutHandler = Effect.gen(function* () {
  const authUser = yield* AuthenticatedUser;
  const authConfig = yield* AuthConfig.AuthConfig;
  const authRepo = yield* AuthRepo.AuthRepo;
  const db = yield* AdminDatabase.AdminDatabase;

  yield* db.transaction((tx) =>
    Effect.gen(function* () {
      return yield* authRepo.session.deleteSession(authUser.session.id);
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
}).pipe(mapDatabaseError);

const revokeOtherSessionsHandler = Effect.gen(function* () {
  const authUser = yield* AuthenticatedUser;
  const authRepo = yield* AuthRepo.AuthRepo;
  const db = yield* AdminDatabase.AdminDatabase;

  const deletedSessions = yield* db.transaction((tx) =>
    Effect.gen(function* () {
      return yield* authRepo.session.deleteAllSessionsExcept(
        authUser.user.id,
        authUser.session.id,
      );
    }).pipe(Transaction.withTx(tx)),
  );

  return deletedSessions.length;
}).pipe(mapDatabaseError);

export const AuthCoreGroupLive = HttpApiBuilder.group(api, "auth", (handlers) =>
  handlers
    .handle("currentUser", currentUserHandler)
    .handle("listSessions", () => listSessionsHandler)
    .handle("logout", () => logoutHandler)
    .handle("revokeOtherSessions", () => revokeOtherSessionsHandler),
);
