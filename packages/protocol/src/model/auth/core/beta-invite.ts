import { Schema } from "effect";

import { Email, UserId } from "#/common/index";

import { UserMetadata } from "./user.js";

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

/** Derived from the timestamps on each read, never stored. */
export const BetaInviteStatus = Schema.Literals(["active", "redeemed", "revoked", "expired"]);
export type BetaInviteStatus = typeof BetaInviteStatus.Type;

/** An invite as an operator sees it: no `codeHmac`, plus the redeemer's email. */
export const BetaInviteListEntry = Schema.Struct({
  id: Schema.String,
  email: Schema.NullOr(Email),
  createdAt: Schema.DateTimeUtcFromDate,
  expiresAt: Schema.DateTimeUtcFromDate,
  redeemedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  redeemedBy: Schema.NullOr(UserId),
  redeemedByEmail: Schema.NullOr(Email),
  redeemedByMetadata: Schema.NullOr(UserMetadata),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  status: BetaInviteStatus,
});
export type BetaInviteListEntry = typeof BetaInviteListEntry.Type;
