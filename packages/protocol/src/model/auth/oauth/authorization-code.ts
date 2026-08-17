import { Schema } from "effect";

import { OAuthAuthorizationId, OAuthAuthorizationCodeId, OAuthClientId } from "#/common/index";
import { createInsertSchema } from "#/model/helpers";

import { OAuthPkceCodeChallenge, OAuthScopes } from "./common.js";

export const OAuthAuthorizationCode = Schema.Struct({
  id: OAuthAuthorizationCodeId,
  authorizationId: OAuthAuthorizationId,
  clientId: OAuthClientId,
  codeHash: Schema.NonEmptyString,
  redirectUri: Schema.NonEmptyString,
  codeChallenge: OAuthPkceCodeChallenge,
  codeChallengeMethod: Schema.Literal("S256"),
  resource: Schema.NonEmptyString,
  scopes: OAuthScopes,
  expiresAt: Schema.DateTimeUtcFromDate,
  consumedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  createdAt: Schema.DateTimeUtcFromDate,
});

export const OAuthAuthorizationCodeInsert = createInsertSchema(
  OAuthAuthorizationCode,
  "authorizationId",
  "clientId",
  "codeHash",
  "redirectUri",
  "codeChallenge",
  "codeChallengeMethod",
  "resource",
  "scopes",
  "expiresAt",
);

export type OAuthAuthorizationCode = typeof OAuthAuthorizationCode.Type;
export type OAuthAuthorizationCodeInsert = typeof OAuthAuthorizationCodeInsert.Type;
