import {
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from "@effect/platform";
import type { Session, User } from "@namera-ai/schema";
import { Context, Schema } from "effect";

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  HttpApiSchema.annotations({ status: 401 }),
) {}

export class AuthenticatedUser extends Context.Tag("AuthenticatedUser")<
  AuthenticatedUser,
  {
    user: User;
    session: Session;
  }
>() {}

export const security = HttpApiSecurity.apiKey({
  in: "cookie",
  key: "auth-token",
});

export class Authorization extends HttpApiMiddleware.Tag<Authorization>()(
  "Authorization",
  {
    failure: Unauthorized,
    provides: AuthenticatedUser,
    security: {
      authToken: security,
    },
  },
) {}
