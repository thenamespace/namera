import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthTokenSecurity } from "@namera-ai/api";
import { authPolicy } from "@namera-ai/application";

const options = {
  path: authPolicy.cookie.path,
  httpOnly: authPolicy.cookie.httpOnly,
  secure: authPolicy.cookie.secure,
  sameSite: authPolicy.cookie.sameSite,
} as const;

export const setAuthCookie = (token: string) =>
  HttpApiBuilder.securitySetCookie(AuthTokenSecurity, token, {
    ...options,
    maxAge: authPolicy.session.timeToLive,
  });

export const clearAuthCookie = HttpApiBuilder.securitySetCookie(AuthTokenSecurity, "", {
  ...options,
  maxAge: 0,
});
