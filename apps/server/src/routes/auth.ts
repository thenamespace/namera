import { HttpApiBuilder, HttpServerResponse } from "@effect/platform";
import { api, CurrentUser } from "@repo/api";
import { Auth, AuthConfig } from "@repo/auth";
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

export const AuthGroupLive = HttpApiBuilder.group(api, "auth", (handlers) =>
  handlers
    .handle("signInMagicLink", ({ payload }) => signInMagicLinkHandler(payload))
    .handle("magicLinkVerify", ({ payload }) => magicLinkVerifyHandler(payload))
    .handle("currentUser", () =>
      Effect.gen(function* () {
        const res = yield* CurrentUser;
        return res;
      }),
    ),
);
