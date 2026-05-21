import { Effect } from "effect";

import { HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthenticatedUser, api } from "@namera-ai/api";
import { AuthConfig } from "@namera-ai/auth";
import { AdminDatabase, Transaction } from "@namera-ai/database";
import * as AuthRepo from "@namera-ai/domain/auth";

const currentUserHandler = Effect.fnUntraced(function* () {
  const res = yield* AuthenticatedUser;
  return res;
});

const listSessionsHandler = () =>
  Effect.gen(function* () {
    const user = (yield* AuthenticatedUser).user;
    const authRepo = yield* AuthRepo.AuthRepo;
    const db = yield* AdminDatabase.AdminDatabase;

    const sessions = yield* db
      .transaction((tx) =>
        authRepo.session
          .findSessionsByUserId(user.id)
          .pipe(Transaction.withTx(tx)),
      )
      .pipe(Effect.orDie);

    return sessions.map(({ token: _t, ...session }) => {
      return session;
    });
  });

const logoutHandler = () =>
  Effect.gen(function* () {
    const authUser = yield* AuthenticatedUser;
    const authConfig = yield* AuthConfig.AuthConfig;
    const authRepo = yield* AuthRepo.AuthRepo;
    const db = yield* AdminDatabase.AdminDatabase;

    yield* db
      .transaction((tx) =>
        authRepo.session
          .deleteSession(authUser.session.id)
          .pipe(Transaction.withTx(tx)),
      )
      .pipe(Effect.orDie);

    return yield* HttpServerResponse.empty({ status: 200 }).pipe(
      HttpServerResponse.expireCookie(authConfig.session.cookieName, {
        domain: authConfig.session.domain,
        secure: authConfig.session.secure,
        ...(authConfig.session.domain
          ? { domain: authConfig.session.domain }
          : {}),
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      }),
      Effect.orDie,
    );
  });

const revokeOtherSessionsHandler = () =>
  Effect.gen(function* () {
    const authUser = yield* AuthenticatedUser;
    const authRepo = yield* AuthRepo.AuthRepo;
    const db = yield* AdminDatabase.AdminDatabase;

    const deletedSessions = yield* db
      .transaction((tx) =>
        authRepo.session
          .deleteAllSessionsExcept(authUser.user.id, authUser.session.id)
          .pipe(Transaction.withTx(tx)),
      )
      .pipe(Effect.orDie);

    return deletedSessions.length;
  });

export const AuthGroupLive = HttpApiBuilder.group(api, "auth", (handlers) =>
  handlers
    .handle("currentUser", () => currentUserHandler())
    .handle("listSessions", () => listSessionsHandler())
    .handle("logout", () => logoutHandler())
    .handle("revokeOtherSessions", () => revokeOtherSessionsHandler()),
);
