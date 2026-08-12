import { Schema, Struct } from "effect";

import { Email } from "#/common/index";
import { NonEmptyString } from "#/model/common";

export const EmailJobType = Schema.Literals(["magic-link"]);

export const EmailRecipient = Schema.Union([
  Email,
  Schema.Array(Email).check(Schema.isMinLength(1)),
]);

export const EmailTag = Schema.Struct({
  name: NonEmptyString,
  value: NonEmptyString,
});

const EmailPayloadFields = Schema.Struct({
  to: EmailRecipient,
  from: Schema.optionalKey(NonEmptyString),
  subject: Schema.optionalKey(NonEmptyString),
  replyTo: Schema.optionalKey(EmailRecipient),
  cc: Schema.optionalKey(EmailRecipient),
  bcc: Schema.optionalKey(EmailRecipient),
  tags: Schema.optionalKey(Schema.Array(EmailTag)),
});

export const MagicLinkEmailVariables = Schema.Struct({
  magicLinkUrl: NonEmptyString,
  code: NonEmptyString,
  expiresInMinutes: Schema.Int.check(Schema.isGreaterThan(0)),
});

export const EmailJobPayload = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("magic-link"),
    variables: MagicLinkEmailVariables,
  }).mapFields(Struct.assign(EmailPayloadFields.fields)),
]);

export type EmailJobType = typeof EmailJobType.Type;
export type EmailRecipient = typeof EmailRecipient.Type;
export type EmailTag = typeof EmailTag.Type;
export type MagicLinkEmailVariables = typeof MagicLinkEmailVariables.Type;
export type EmailJobPayload = typeof EmailJobPayload.Type;
