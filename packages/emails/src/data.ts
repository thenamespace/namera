import { Duration, Schema } from "effect";

import { MagicLinkVariables } from "./types.js";

export const emailTemplates = {
  "magic-link": {
    id: "magic-link", // TODO: Update
    variables: MagicLinkVariables,
  },
} as const;

export const emailPolicy = {
  requestTimeout: Duration.seconds(10),
} as const;

export type EmailTemplateType = keyof typeof emailTemplates;

export type EmailTemplateVariables<Type extends EmailTemplateType> = Schema.Schema.Type<
  (typeof emailTemplates)[Type]["variables"]
>;

export const EmailProviderId = Schema.NonEmptyString.pipe(
  Schema.brand("@namera-ai/emails/EmailProviderId"),
);
export type EmailProviderId = typeof EmailProviderId.Type;
