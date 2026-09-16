import { Schema } from "effect";

import { JoinWaitlistRequest } from "@namera-ai/protocol/dto";

export const WaitlistFormValidator = Schema.toStandardSchemaV1(JoinWaitlistRequest);
export type WaitlistFormInput = typeof JoinWaitlistRequest.Encoded;
export type WaitlistFormOutput = typeof JoinWaitlistRequest.Type;
