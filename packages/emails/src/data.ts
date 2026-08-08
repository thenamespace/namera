import { Schema } from "effect";

import type { Email } from "@namera-ai/protocol";

export const MagicLinkVariables = Schema.Struct({
  magicLinkUrl: Schema.NonEmptyString,
  code: Schema.NonEmptyString,
  expiresInMinutes: Schema.Int.check(Schema.isGreaterThan(0)),
});

export const emailTemplates = {
  "magic-link": {
    id: "magic-link",
    variables: MagicLinkVariables,
  },
} as const;

export type EmailTemplateType = keyof typeof emailTemplates;

export type EmailTemplateVariables<Type extends EmailTemplateType> = Schema.Schema.Type<
  (typeof emailTemplates)[Type]["variables"]
>;

export interface EmailTag {
  readonly name: string;
  readonly value: string;
}

interface SendEmailBase {
  readonly to: Email | ReadonlyArray<Email>;
  readonly from?: string;
  readonly subject?: string;
  readonly replyTo?: string | ReadonlyArray<string>;
  readonly cc?: Email | ReadonlyArray<Email>;
  readonly bcc?: Email | ReadonlyArray<Email>;
  readonly tags?: ReadonlyArray<EmailTag>;
  readonly idempotencyKey?: string;
}

export type SendEmail = {
  readonly [Type in EmailTemplateType]: SendEmailBase & {
    readonly type: Type;
    readonly variables: EmailTemplateVariables<Type>;
  };
}[EmailTemplateType];

export const EmailProviderId = Schema.NonEmptyString.pipe(
  Schema.brand("@namera-ai/emails/EmailProviderId"),
);
export type EmailProviderId = typeof EmailProviderId.Type;

export class EmailSendError extends Schema.TaggedError<EmailSendError>()("EmailSendError", {
  reason: Schema.Literals(["REQUEST_FAILED", "PROVIDER_REJECTED", "INVALID_RESPONSE"]),
  cause: Schema.Defect(),
}) {}
