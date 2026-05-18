import type { OrganizationMember, Session, User } from "@namera-ai/schema";

import { Schema, Context } from "effect";

import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";

import { Organization } from "@namera-ai/schema";

export class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()(
  "Unauthorized",
  {},
  { httpApiStatus: 401 },
) {}

export class AuthenticatedUser extends Context.Service<
  AuthenticatedUser,
  {
    user: User;
    session: Session;
    activeOrganization:
      | (Organization & {
          member: OrganizationMember;
        })
      | null;
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
