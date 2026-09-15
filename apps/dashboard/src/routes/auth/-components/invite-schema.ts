import { Schema } from "effect";

import { RedeemBetaInviteRequest } from "@namera-ai/protocol/dto";

export const InviteFormValidator = Schema.toStandardSchemaV1(RedeemBetaInviteRequest);
export type InviteFormInput = typeof RedeemBetaInviteRequest.Type;
