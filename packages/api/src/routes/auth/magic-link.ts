import { Schema } from "effect";

import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import { InternalError } from "@namera-ai/schema";
import {
  MagicLinkError,
  OrganizationError,
  SigInMagicLinkBody,
  VerifyMagicLinkBody,
} from "@namera-ai/schema/dto";

export const magicLinkGroup = HttpApiGroup.make("magicLink")
  .add(
    HttpApiEndpoint.post("signIn", "/sign-in", {
      payload: SigInMagicLinkBody,
      error: [MagicLinkError, InternalError],
    }),
  )
  .add(
    HttpApiEndpoint.get("verify", "/verify", {
      success: Schema.Void.pipe(HttpApiSchema.status(302)),
      error: [
        MagicLinkError.pipe(HttpApiSchema.status(400)),
        OrganizationError,
        InternalError,
      ],
      query: VerifyMagicLinkBody,
    }),
  )
  .prefix("/auth/magic-link");
