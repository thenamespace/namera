import { Context } from "effect";

import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";

import { AuthenticatedUserResponse, Unauthorized } from "@namera-ai/schema";

export class AuthenticatedUser extends Context.Service<
  AuthenticatedUser,
  AuthenticatedUserResponse
>()("AuthenticatedUser") {}

export class Authorization extends HttpApiMiddleware.Service<
  Authorization,
  {
    provides: AuthenticatedUser;
  }
>()("Authorization", {
  error: Unauthorized,
  security: {
    authToken: HttpApiSecurity.apiKey({
      in: "cookie",
      key: "auth-token",
    }),
  },
}) {}
