import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { MagicLinkError, SigInMagicLinkBody } from "@repo/schema";
import { Schema } from "effect";

export const authGroup = HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.post("signInMagicLink", "/sign-in/magic-link")
      .setPayload(SigInMagicLinkBody)
      .addError(MagicLinkError, { status: 400 })
      .addSuccess(Schema.Any, { status: 200 }),
  )
  .prefix("/auth");
