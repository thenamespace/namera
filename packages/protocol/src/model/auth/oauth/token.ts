import { Schema } from "effect";

import {
  OAuthAuthorizationId,
  OAuthClientId,
  OAuthTokenFamilyId,
  OAuthTokenId,
} from "#/common/index";
import { createInsertSchema } from "#/model/helpers";

import { OAuthScopes } from "./common.js";

export const OAuthTokenType = Schema.Literals(["access", "refresh"]);

const OAuthTokenFields = {
  id: OAuthTokenId,
  authorizationId: OAuthAuthorizationId,
  clientId: OAuthClientId,
  tokenHash: Schema.NonEmptyString,
  resource: Schema.NonEmptyString,
  scopes: OAuthScopes,
  expiresAt: Schema.DateTimeUtcFromDate,
  consumedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  createdAt: Schema.DateTimeUtcFromDate,
};

export const OAuthAccessToken = Schema.Struct({
  ...OAuthTokenFields,
  type: Schema.Literal("access"),
  familyId: Schema.Null,
  parentId: Schema.Null,
});

export const OAuthRefreshToken = Schema.Struct({
  ...OAuthTokenFields,
  type: Schema.Literal("refresh"),
  familyId: OAuthTokenFamilyId,
  parentId: Schema.NullOr(OAuthTokenId),
});

export const OAuthToken = Schema.Union([OAuthAccessToken, OAuthRefreshToken]);

const OAuthTokenInsertFields = [
  "authorizationId",
  "clientId",
  "type",
  "tokenHash",
  "familyId",
  "parentId",
  "resource",
  "scopes",
  "expiresAt",
] as const;

export const OAuthAccessTokenInsert = createInsertSchema(
  OAuthAccessToken,
  ...OAuthTokenInsertFields,
);
export const OAuthRefreshTokenInsert = createInsertSchema(
  OAuthRefreshToken,
  ...OAuthTokenInsertFields,
);
export const OAuthTokenInsert = Schema.Union([OAuthAccessTokenInsert, OAuthRefreshTokenInsert]);

export type OAuthTokenType = typeof OAuthTokenType.Type;
export type OAuthAccessToken = typeof OAuthAccessToken.Type;
export type OAuthRefreshToken = typeof OAuthRefreshToken.Type;
export type OAuthToken = typeof OAuthToken.Type;
export type OAuthAccessTokenInsert = typeof OAuthAccessTokenInsert.Type;
export type OAuthRefreshTokenInsert = typeof OAuthRefreshTokenInsert.Type;
export type OAuthTokenInsert = typeof OAuthTokenInsert.Type;
