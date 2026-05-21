import { Schema } from "effect";

import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import { Authorization, Unauthorized } from "@/middlewares";
import {
  AuthenticatedUserResponse,
  ListSessionResponse,
  MagicLinkError,
  SigInMagicLinkBody,
  VerifyMagicLinkBody,
} from "@namera-ai/schema";

export const magicLinkGroup = HttpApiGroup.make("magicLink")
  .add(
    HttpApiEndpoint.post("signIn", "/sign-in", {
      payload: SigInMagicLinkBody,
      error: MagicLinkError,
      success: Schema.Void,
    }),
  )
  .add(
    HttpApiEndpoint.get("verify", "/verify", {
      success: Schema.Void.pipe(HttpApiSchema.status(302)),
      error: MagicLinkError.pipe(HttpApiSchema.status(400)),
      query: VerifyMagicLinkBody,
    }),
  )
  .prefix("/auth/magic-link");

export const authGroup = HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.get("currentUser", "/me", {
      success: AuthenticatedUserResponse,
      error: Unauthorized,
    }),
  )
  .add(
    HttpApiEndpoint.get("listSessions", "/sessions", {
      success: ListSessionResponse,
      error: Unauthorized,
    }),
  )
  .add(
    HttpApiEndpoint.delete("logout", "/sessions/me", {
      success: Schema.Void,
      error: Unauthorized,
    }),
  )
  .add(
    HttpApiEndpoint.post("revokeOtherSessions", "/sessions", {
      success: Schema.Int,
      error: Unauthorized,
    }),
  )
  .middleware(Authorization)
  .prefix("/auth");
