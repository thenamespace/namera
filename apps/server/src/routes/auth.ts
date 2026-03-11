import { HttpApiBuilder, HttpServerResponse } from "@effect/platform";
import { AuthenticatedUser, api } from "@repo/api";
import { Auth, AuthConfig } from "@repo/auth";
import { AdminDatabase, withTx } from "@repo/database";
import { AuthRepo } from "@repo/domain/auth";
import type { SigInMagicLinkBody, VerifyMagicLinkBody } from "@repo/schema";
import { Effect } from "effect";

const signInMagicLinkHandler = (payload: SigInMagicLinkBody) =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    yield* auth.magicLink.signInMagicLink(payload);
  });

const magicLinkVerifyHandler = (payload: VerifyMagicLinkBody) =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    const authConfig = yield* AuthConfig;
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

const currentUserHandler = () =>
  Effect.gen(function* () {
    const res = yield* AuthenticatedUser;
    return res.user;
  });

const listSessionsHandler = () =>
  Effect.gen(function* () {
    const user = (yield* AuthenticatedUser).user;
    const authRepo = yield* AuthRepo;
    const db = yield* AdminDatabase;

    const sessions = yield* db
      .transaction((tx) =>
        authRepo.session.findSessionsByUserId(user.id).pipe(withTx(tx)),
      )
      .pipe(Effect.orDie);

    return sessions;
  });

const logoutHandler = () =>
  Effect.gen(function* () {
    const authUser = yield* AuthenticatedUser;
    const authConfig = yield* AuthConfig;
    const authRepo = yield* AuthRepo;
    const db = yield* AdminDatabase;

    yield* db
      .transaction((tx) =>
        authRepo.session.deleteSession(authUser.session.id).pipe(withTx(tx)),
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
    const authConfig = yield* AuthConfig;
    const authRepo = yield* AuthRepo;
    const db = yield* AdminDatabase;

    yield* db
      .transaction((tx) =>
        authRepo.session
          .deleteAllSessionsExcept(authUser.user.id, authUser.session.id)
          .pipe(withTx(tx)),
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
    .handle("signInMagicLink", ({ payload }) => signInMagicLinkHandler(payload))
    .handle("magicLinkVerify", ({ payload }) => magicLinkVerifyHandler(payload))
    .handle("currentUser", () => currentUserHandler())
    .handle("listSessions", () => listSessionsHandler())
    .handle("logout", () => logoutHandler())
    .handle("revokeOtherSessions", () => revokeOtherSessionsHandler()),
);
