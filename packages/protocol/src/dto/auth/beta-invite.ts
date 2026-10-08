import { Schema } from "effect";

export const BetaInviteCode = Schema.String.check(
  Schema.isPattern(/^[A-HJ-NP-Z2-9]{6}$/, { message: "Enter the six-character invite code." }),
).annotate({
  identifier: "BetaInviteCode",
  description: "Six uppercase letters or digits, excluding I, O, 0 and 1",
});
export const RedeemBetaInviteRequest = Schema.Struct({ inviteCode: BetaInviteCode }).annotate({
  identifier: "RedeemBetaInviteRequest",
  description: "Complete signup using an invite after email verification",
});
