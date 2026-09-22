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

/**
 * Derived, never stored. Priority is redeemed > revoked > expired > active.
 * The first two are mutually exclusive by `beta_invite_terminal_check`, so the
 * order only matters for readability.
 */
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
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  status: BetaInviteStatus,
});
export type BetaInviteListEntry = typeof BetaInviteListEntry.Type;
