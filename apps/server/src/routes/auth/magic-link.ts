import type {
  SigInMagicLinkBody,
  VerifyMagicLinkBody,
} from "@namera-ai/schema";

import { Effect } from "effect";

import { HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { api } from "@namera-ai/api";
import { Auth, AuthConfig } from "@namera-ai/auth";

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

    return yield* HttpServerResponse.redirect(res.redirectUrl)
      .pipe(
        HttpServerResponse.setCookie(authConfig.session.cookieName, res.token, {
          ...authConfig.session.cookieOpts,
          maxAge: authConfig.session.expiresIn,
        }),
      )
      .pipe(Effect.orDie);
  });

export const MagicLinkGroupLive = HttpApiBuilder.group(
  api,
  "magicLink",
  (handlers) =>
    handlers
      .handle("signIn", ({ payload }) => signInMagicLinkHandler(payload))
      .handle("verify", ({ query }) => magicLinkVerifyHandler(query)),
);
