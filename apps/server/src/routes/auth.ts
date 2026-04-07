import type {
  SigInMagicLinkBody,
  VerifyMagicLinkBody,
} from "@namera-ai/schema";

import { Effect } from "effect";

import { HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthenticatedUser, api } from "@namera-ai/api";
import { Auth, AuthConfig } from "@namera-ai/auth";
import { AdminDatabase, Transaction } from "@namera-ai/database";
import { AuthRepo } from "@namera-ai/domain";

const signInMagicLinkHandler = (payload: SigInMagicLinkBody) =>
  Effect.gen(function* () {
    const auth = yield* Auth.Auth;
    yield* auth.magicLink.signInMagicLink(payload);
  });

const magicLinkVerifyHandler = (payload: VerifyMagicLinkBody) =>
  Effect.gen(function* () {
    const auth = yield* Auth.Auth;
    const authConfig = yield* AuthConfig.AuthConfig;
    const res = yield* auth.magicLink.verifyMagicLink(payload);

    const redirectUrl = res.isNewUser
      ? payload.newUserCallbackUrl
      : payload.callbackUrl;

    return yield* HttpServerResponse.empty({ status: 302 })
      .pipe(
        HttpServerResponse.setHeader("Location", redirectUrl.toString()),
        HttpServerResponse.setCookie(authConfig.session.cookieName, res.token, {
          ...(authConfig.session.domain
            ? { domain: authConfig.session.domain }
            : {}),
          httpOnly: true,
          maxAge: authConfig.session.expiresIn,
          path: "/",
          sameSite: "lax",
          secure: authConfig.session.secure,
        }),
      )
      .pipe(Effect.orDie);
  });

const currentUserHandler = Effect.fnUntraced(function* () {
  const res = yield* AuthenticatedUser;
  return res.user;
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

    return sessions;
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
        path: "/",
      }),
      Effect.orDie,
    );
  });

const revokeOtherSessionsHandler = () =>
  Effect.gen(function* () {
    const authUser = yield* AuthenticatedUser;
    const authConfig = yield* AuthConfig.AuthConfig;
    const authRepo = yield* AuthRepo.AuthRepo;
    const db = yield* AdminDatabase.AdminDatabase;

    yield* db
      .transaction((tx) =>
        authRepo.session
          .deleteAllSessionsExcept(authUser.user.id, authUser.session.id)
          .pipe(Transaction.withTx(tx)),
      )
      .pipe(Effect.orDie);

    return yield* HttpServerResponse.empty({ status: 200 }).pipe(
      HttpServerResponse.expireCookie(authConfig.session.cookieName, {
        path: "/",
      }),
      Effect.orDie,
    );
  });

export const AuthGroupLive = HttpApiBuilder.group(api, "auth", (handlers) =>
  handlers
    .handle("currentUser", currentUserHandler)
    .handle("listSessions", () => listSessionsHandler())
    .handle("logout", () => logoutHandler())
    .handle("revokeOtherSessions", () => revokeOtherSessionsHandler()),
);

export const MagicLinkGroupLive = HttpApiBuilder.group(
  api,
  "magicLink",
  (handlers) =>
    handlers
      .handle("signInMagicLink", ({ payload }) =>
        signInMagicLinkHandler(payload),
      )
      .handle("magicLinkVerify", ({ query }) => magicLinkVerifyHandler(query)),
);
