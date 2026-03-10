import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import {
  MagicLinkError,
  SigInMagicLinkBody,
  User,
  VerifyMagicLinkBody,
} from "@repo/schema";
import { Schema } from "effect";

import { Authorization } from "@/middlewares";

export const authGroup = HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.post("signInMagicLink", "/sign-in/magic-link")
      .setPayload(SigInMagicLinkBody)
      .addError(MagicLinkError, { status: 400 })
      .addSuccess(Schema.Any, { status: 200 }),
  )
  .add(
    HttpApiEndpoint.get("magicLinkVerify", "/magic-link/verify")
      .setPayload(VerifyMagicLinkBody)
      .addError(MagicLinkError, { status: 400 })
      .addSuccess(Schema.Void, { status: 302 }),
  )
  .add(
    HttpApiEndpoint.get("currentUser", "/me")
      .addSuccess(User, { status: 200 })
      .middleware(Authorization),
  )
  .prefix("/auth");
