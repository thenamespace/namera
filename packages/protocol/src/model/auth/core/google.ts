import { Schema } from "effect";

import { Email, SessionId, UserId } from "#/common/index";

export const GoogleIdentity = Schema.Struct({
  subject: Schema.NonEmptyString,
  email: Email,
  emailAuthoritative: Schema.Boolean,
  name: Schema.optionalKey(Schema.String),
  image: Schema.optionalKey(Schema.String),
});
export type GoogleIdentity = typeof GoogleIdentity.Type;

export const GoogleVerificationData = Schema.Struct({
  version: Schema.Literal(1),
  intent: Schema.Literals(["sign-in", "link"]),
  nonceHash: Schema.NonEmptyString,
  browserHash: Schema.NonEmptyString,
  encryptedVerifier: Schema.NonEmptyString,
  returnTo: Schema.String,
  inviteCode: Schema.optionalKey(Schema.String),
  userId: Schema.NullOr(UserId),
  sessionId: Schema.NullOr(SessionId),
});
