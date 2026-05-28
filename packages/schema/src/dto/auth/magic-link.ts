import { Schema } from "effect";

import { Email } from "../../common";

export class MagicLinkError extends Schema.TaggedErrorClass<MagicLinkError>()(
  "MagicLinkError",
  {
    code: Schema.Literals([
      "INVALID_TOKEN",
      "TOKEN_EXPIRED",
      "SEND_EMAIL_FAILED",
      "ATTEMPTS_EXCEEDED",
      "TOKEN_NOT_FOUND",
      "INVALID_ORIGIN",
    ]),
    message: Schema.optional(Schema.String),
  },
) {}

export const SigInMagicLinkBody = Schema.Struct({
  email: Email.annotate({
    description: "Email address to send the magic link",
  }),
  callbackUrl: Schema.URL.annotate({
    description: "URL to redirect after magic link verification",
  }),
  newUserCallbackUrl: Schema.URL.annotate({
    description:
      "URL to redirect after new user signup. Only used if the user is registering for the first time.",
  }),
  errorCallbackUrl: Schema.URL.annotate({
    description: "URL to redirect to after encountering an error",
  }),
});

export const VerifyMagicLinkBody = Schema.Struct({
  token: Schema.String.annotate({
    description: "Magic link token",
  }),
});

export type SigInMagicLinkBody = typeof SigInMagicLinkBody.Type;
export type VerifyMagicLinkBody = typeof VerifyMagicLinkBody.Type;
