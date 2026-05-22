import { Schema } from "effect";

import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import {
  DatabaseError,
  MagicLinkError,
  SigInMagicLinkBody,
  VerifyMagicLinkBody,
} from "@namera-ai/schema";

export const magicLinkGroup = HttpApiGroup.make("magicLink")
  .add(
    HttpApiEndpoint.post("signIn", "/sign-in", {
      payload: SigInMagicLinkBody,
      error: [MagicLinkError, DatabaseError],
      success: Schema.Void,
    }),
  )
  .add(
    HttpApiEndpoint.get("verify", "/verify", {
      success: Schema.Void.pipe(HttpApiSchema.status(302)),
      error: [MagicLinkError.pipe(HttpApiSchema.status(400)), DatabaseError],
      query: VerifyMagicLinkBody,
    }),
  )
  .prefix("/auth/magic-link");
