import { Schema } from "effect";

import { Email } from "#/common/index";

export const BetaInviteCode = Schema.String.check(
  Schema.isPattern(/^[A-HJ-NP-Z2-9]{6}$/, { message: "Enter the six-character invite code." }),
).annotate({
  identifier: "BetaInviteCode",
  description: "Six uppercase letters or digits, excluding I, O, 0 and 1",
});
export const CreateBetaInvitesRequest = Schema.Struct({
  count: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 50 })),
  expiresInDays: Schema.optionalKey(
    Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 30 })),
  ),
  email: Schema.optionalKey(Email),
}).annotate({
  identifier: "CreateBetaInvitesRequest",
  description: "Generate 1–50 single-use invites; expiry defaults to seven days",
});
export const BetaInviteResponse = Schema.Struct({
  id: Schema.String,
  code: BetaInviteCode,
  url: Schema.String,
  expiresAt: Schema.DateTimeUtcFromDate,
});
export const CreateBetaInvitesResponse = Schema.Struct({
  invites: Schema.Array(BetaInviteResponse),
}).annotate({ identifier: "CreateBetaInvitesResponse" });
export const RedeemBetaInviteRequest = Schema.Struct({ inviteCode: BetaInviteCode }).annotate({
  identifier: "RedeemBetaInviteRequest",
  description: "Complete signup using an invite after email verification",
});
export type CreateBetaInvitesRequest = typeof CreateBetaInvitesRequest.Type;
