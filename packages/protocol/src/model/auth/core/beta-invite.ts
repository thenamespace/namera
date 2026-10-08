import { Schema } from "effect";

import { Email, UserId } from "#/common/index";

export const BetaInvite = Schema.Struct({
  id: Schema.String,
  codeHmac: Schema.String,
  email: Schema.NullOr(Email),
  createdAt: Schema.DateTimeUtcFromDate,
  expiresAt: Schema.DateTimeUtcFromDate,
  redeemedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  redeemedBy: Schema.NullOr(UserId),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
});
export type BetaInvite = typeof BetaInvite.Type;

export const BetaInviteEventType = Schema.Literals(["created", "revoked", "redeemed"]);
export type BetaInviteEventType = typeof BetaInviteEventType.Type;
