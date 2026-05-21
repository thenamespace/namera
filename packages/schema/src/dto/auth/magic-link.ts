import { Schema } from "effect";

import { Session, User } from "../../auth";
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
  callbackUrl: Schema.URL.annotate({
    description: "URL to redirect after magic link verification",
  }),
  email: Email.annotate({
    description: "Email address to send the magic link",
  }),
  name: Schema.String.check(Schema.isLengthBetween(4, 255)).annotate({
    description:
      "User display name. Only used if the user is registering for the first time.",
  }),
  newUserCallbackUrl: Schema.URL.annotate({
    description:
      "URL to redirect after new user signup. Only used if the user is registering for the first time.",
  }),
});

export type SigInMagicLinkBody = typeof SigInMagicLinkBody.Type;

export const VerifyMagicLinkBody = Schema.Struct({
  token: Schema.String.annotate({
    description: "Magic link token",
  }),
});

export const VerifyMagicLinkResponse = Schema.Struct({
  isNewUser: Schema.Boolean,
  session: Session,
  token: Schema.String,
  user: User,
  redirectUrl: Schema.URL,
});

export type VerifyMagicLinkBody = typeof VerifyMagicLinkBody.Type;
export type VerifyMagicLinkResponse = typeof VerifyMagicLinkResponse.Type;
