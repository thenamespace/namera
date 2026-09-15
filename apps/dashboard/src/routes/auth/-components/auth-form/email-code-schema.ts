import { Schema } from "effect";

import { Email } from "@namera-ai/protocol";
import { MagicLinkCode } from "@namera-ai/protocol/dto";

export const EmailCodeSchema = Schema.Struct({ email: Email, code: MagicLinkCode });
export const EmailCodeValidator = Schema.toStandardSchemaV1(EmailCodeSchema);
export type EmailCodeInput = typeof EmailCodeSchema.Encoded;
export type EmailCodeOutput = typeof EmailCodeSchema.Type;
