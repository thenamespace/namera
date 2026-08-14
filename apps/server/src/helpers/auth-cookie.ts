import { Config, Context, Effect, Layer } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthTokenSecurity } from "@namera-ai/api";
import { authPolicy } from "@namera-ai/application";

export class AuthCookieConfig extends Context.Service<
  AuthCookieConfig,
  { readonly secure: boolean }
>()("@namera-ai/server/AuthCookieConfig") {
  static readonly layer = Layer.effect(
    AuthCookieConfig,
    Effect.map(Config.string("NODE_ENV").pipe(Config.withDefault("development")), (environment) =>
      AuthCookieConfig.of({ secure: environment !== "development" }),
    ),
  );

  static readonly devLayer = Layer.succeed(
    AuthCookieConfig,
    AuthCookieConfig.of({ secure: false }),
  );

  static readonly testLayer = AuthCookieConfig.devLayer;
}

const cookieOptions = (secure: boolean) => ({
  path: authPolicy.cookie.path,
  httpOnly: authPolicy.cookie.httpOnly,
  secure,
  sameSite: authPolicy.cookie.sameSite,
});

export const setAuthCookie = (token: string, secure: boolean) =>
  HttpApiBuilder.securitySetCookie(AuthTokenSecurity, token, {
    ...cookieOptions(secure),
    maxAge: authPolicy.session.timeToLive,
  });

export const clearAuthCookie = (secure: boolean) =>
  HttpApiBuilder.securitySetCookie(AuthTokenSecurity, "", {
    ...cookieOptions(secure),
    maxAge: 0,
  });
