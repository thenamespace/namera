import { Schema } from "effect";

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { Unauthorized } from "@/middlewares";
import {
  MagicLinkError,
  Session,
  SigInMagicLinkBody,
  User,
  VerifyMagicLinkBody,
} from "@namera-ai/schema";

export const authGroup = HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.post("signInMagicLink", "/sign-in/magic-link", {
      payload: SigInMagicLinkBody,
      error: MagicLinkError,
      success: Schema.Void,
    }),
  )
  .add(
    HttpApiEndpoint.get("magicLinkVerify", "/magic-link/verify", {
      success: Schema.Void.pipe(HttpApiSchema.status(302)),
      error: MagicLinkError.pipe(HttpApiSchema.status(400)),
      query: VerifyMagicLinkBody,
    }),
  )
  .add(
    HttpApiEndpoint.get("currentUser", "/me", {
      success: User.pipe(HttpApiSchema.status(200)),
      error: Unauthorized.pipe(HttpApiSchema.status(401)),
    }),
  )
  .add(
    HttpApiEndpoint.get("listSessions", "/sessions", {
      success: Schema.Array(Session).pipe(HttpApiSchema.status(200)),
      error: Unauthorized.pipe(HttpApiSchema.status(401)),
    }),
  )
  .add(
    HttpApiEndpoint.delete("logout", "/sessions/me", {
      success: Schema.Void.pipe(HttpApiSchema.status(200)),
      error: Unauthorized.pipe(HttpApiSchema.status(401)),
    }),
  )
  .add(
    HttpApiEndpoint.post("revokeOtherSessions", "/sessions", {
      success: Schema.Number.pipe(HttpApiSchema.status(200)),
      error: Unauthorized.pipe(HttpApiSchema.status(401)),
    }),
  )
  .prefix("/auth");
