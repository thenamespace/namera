import { Option, Schema, SchemaGetter } from "effect";

import { BetaInviteCode, RequestMagicLinkRequest } from "@namera-ai/protocol/dto";

const EmailFormSchema = Schema.Struct({
  ...RequestMagicLinkRequest.fields,
  inviteCode: Schema.optional(Schema.String).pipe(
    Schema.decodeTo(Schema.optionalKey(BetaInviteCode), {
      decode: SchemaGetter.transformOptional((input) =>
        Option.flatMap(input, (value) =>
          value === undefined || value === "" ? Option.none() : Option.some(value),
        ),
      ),
      encode: SchemaGetter.transformOptional((input) => input),
    }),
  ),
});
export const EmailFormValidator = Schema.toStandardSchemaV1(EmailFormSchema);

export type EmailFormInput = typeof EmailFormSchema.Encoded;
export type EmailFormOutput = typeof EmailFormSchema.Type;
