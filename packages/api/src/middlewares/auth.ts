import type { Session, User } from "@namera-ai/schema";

import { Schema, ServiceMap } from "effect";

import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";

export class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()(
  "Unauthorized",
  {},
  { httpApiStatus: 401 },
) {}

export class AuthenticatedUser extends ServiceMap.Service<
  AuthenticatedUser,
  {
    user: User;
    session: Session;
  }
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
