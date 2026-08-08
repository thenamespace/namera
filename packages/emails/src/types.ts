import { Schema } from "effect";

import type { Email } from "@namera-ai/protocol";

import type { EmailTemplateType, EmailTemplateVariables } from "./data.js";

export const MagicLinkVariables = Schema.Struct({
  magicLinkUrl: Schema.NonEmptyString,
  code: Schema.NonEmptyString,
  expiresInMinutes: Schema.Int.check(Schema.isGreaterThan(0)),
});

interface SendEmailBaseProps {
  readonly to: Email | Array<Email>;
  readonly from?: string;
  readonly subject?: string;
  readonly replyTo?: string | Array<string>;
  readonly cc?: Email | Array<Email>;
  readonly bcc?: Email | Array<Email>;
  readonly tags?: Array<{
    readonly name: string;
    readonly value: string;
  }>;
  readonly idempotencyKey?: string;
}

export type SendEmailProps = {
  readonly [Type in EmailTemplateType]: SendEmailBaseProps & {
    readonly type: Type;
    readonly variables: EmailTemplateVariables<Type>;
  };
}[EmailTemplateType];
