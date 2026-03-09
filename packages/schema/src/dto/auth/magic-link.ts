import { Schema } from "effect";

import { Email } from "@/common";

export class MagicLinkError extends Schema.TaggedError<MagicLinkError>()(
  "MagicLinkError",
  {
    code: Schema.Union(
      Schema.Literal("TOKEN_EXPIRED"),
      Schema.Literal("SEND_EMAIL_FAILED"),
      Schema.Literal("ATTEMPTS_EXCEEDED"),
      Schema.Literal("TOKEN_NOT_FOUND"),
    ),
    message: Schema.optional(Schema.String),
  },
) {}

export const SigInMagicLinkBody = Schema.Struct({
  callbackUrl: Schema.URL.annotations({
    description: "URL to redirect after magic link verification",
  }),
  email: Email.annotations({
    description: "Email address to send the magic link",
  }),
  errorCallbackUrl: Schema.URL.annotations({
    description: "URL to redirect after error.",
  }),
  name: Schema.String.pipe(
    Schema.minLength(4),
    Schema.maxLength(255),
  ).annotations({
    description:
      "User display name. Only used if the user is registering for the first time.",
  }),
  newUserCallbackUrl: Schema.URL.annotations({
    description:
      "URL to redirect after new user signup. Only used if the user is registering for the first time.",
  }),
});

export type SigInMagicLinkBody = typeof SigInMagicLinkBody.Type;

export const VerifyMagicLinkBody = Schema.Struct({
  token: Schema.String.annotations({
    description: "Magic link token",
  }),
}).pipe(Schema.extend(SigInMagicLinkBody.omit("name", "email")));

export type VerifyMagicLinkBody = typeof VerifyMagicLinkBody.Type;
