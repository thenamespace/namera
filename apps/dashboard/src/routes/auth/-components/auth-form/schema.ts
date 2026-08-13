import { Schema } from "effect";

import { RequestMagicLinkRequest } from "@namera-ai/protocol/dto";

export const EmailFormValidator = Schema.toStandardSchemaV1(RequestMagicLinkRequest);

export type EmailFormInput = typeof RequestMagicLinkRequest.Encoded;
export type EmailFormOutput = typeof RequestMagicLinkRequest.Type;
