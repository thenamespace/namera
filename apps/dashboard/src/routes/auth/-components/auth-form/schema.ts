import { Schema } from "effect";

import { Email } from "@namera-ai/protocol";

export const EmailFormSchema = Schema.Struct({
  email: Email,
});

export const EmailFormValidator = Schema.toStandardSchemaV1(EmailFormSchema);

export type EmailFormInput = typeof EmailFormSchema.Encoded;
export type EmailFormOutput = typeof EmailFormSchema.Type;
