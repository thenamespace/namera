import { Schema } from "effect";

import { Email } from "#/common/index";
import { BetaInviteListEntry, BetaInviteStatus } from "#/model/auth/core/beta-invite";

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
export const ListBetaInvitesRequest = Schema.Struct({
  limit: Schema.optionalKey(
    Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 })),
  ),
  cursor: Schema.optionalKey(Schema.String),
  status: Schema.optionalKey(BetaInviteStatus),
  email: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(254))),
}).annotate({ identifier: "ListBetaInvitesRequest" });
export type ListBetaInvitesRequest = typeof ListBetaInvitesRequest.Type;

export const BetaInviteListEntryResponse = BetaInviteListEntry.annotate({
  identifier: "BetaInviteListEntryResponse",
});
export const ListBetaInvitesResponse = Schema.Struct({
  entries: Schema.Array(BetaInviteListEntryResponse),
  nextCursor: Schema.NullOr(Schema.String),
}).annotate({ identifier: "ListBetaInvitesResponse" });

export type CreateBetaInvitesRequest = typeof CreateBetaInvitesRequest.Type;
