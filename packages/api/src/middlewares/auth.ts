import {
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from "@effect/platform";
import type { User } from "@repo/schema";
import { Context, Schema } from "effect";

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  HttpApiSchema.annotations({ status: 401 }),
) {}

export class CurrentUser extends Context.Tag("CurrentUser")<
  CurrentUser,
  User
>() {}

export const security = HttpApiSecurity.apiKey({
  in: "cookie",
  key: "auth-token",
});

export class Authorization extends HttpApiMiddleware.Tag<Authorization>()(
  "Authorization",
  {
    failure: Unauthorized,
    provides: CurrentUser,
    security: {
      authToken: security,
    },
  },
) {}
