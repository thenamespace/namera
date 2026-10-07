import { Schema } from "effect";

import { AccountId, ApplicationRelativePath, Email } from "#/common/index";

import { BetaInviteCode } from "./beta-invite.js";

export const StartGoogleSignInRequest = Schema.Struct({
  returnTo: Schema.optionalKey(ApplicationRelativePath),
  inviteCode: Schema.optionalKey(BetaInviteCode),
});
export const StartGoogleResponse = Schema.Struct({ authorizationUrl: Schema.String });
export const GoogleConfigurationResponse = Schema.Struct({ enabled: Schema.Boolean });
export const ConnectedAccountResponse = Schema.Struct({
  id: AccountId,
  provider: Schema.Literal("google"),
  email: Schema.NullOr(Email),
  createdAt: Schema.DateTimeUtc,
});
export const ConnectedAccountsResponse = Schema.Array(ConnectedAccountResponse);
