import { Schema } from "effect";

import { Email } from "@namera-ai/protocol";
import { MagicLinkCode } from "@namera-ai/protocol/dto";

export const EmailForm = Schema.Struct({ email: Email });
export const EmailValidator = Schema.toStandardSchemaV1(EmailForm);
export const CodeForm = Schema.Struct({ email: Email, code: MagicLinkCode });
export const CodeValidator = Schema.toStandardSchemaV1(CodeForm);
