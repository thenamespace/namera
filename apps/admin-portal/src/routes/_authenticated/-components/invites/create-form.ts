import { Schema } from "effect";

import { Email } from "@namera-ai/protocol";
import { CreateBetaInvitesRequest } from "@namera-ai/protocol/dto";

export const CreateInvitesForm = Schema.Struct({
  count: CreateBetaInvitesRequest.fields.count,
  expiresInDays: Schema.Literals([7, 14, 30]),
  email: Schema.Union([Schema.Literal(""), Email]),
});

export function invitePayload(values: typeof CreateInvitesForm.Type): CreateBetaInvitesRequest {
  return {
    count: values.count,
    expiresInDays: values.expiresInDays,
    ...(values.count === 1 && values.email ? { email: values.email } : {}),
  };
}
