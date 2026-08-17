import { Schema, Struct } from "effect";

import { OAuthClientId } from "#/common/index";
import { TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

export const OAuthClientRegistrationType = Schema.Literals([
  "metadata-document",
  "pre-registered",
  "dynamic",
]);
export const OAuthClientStatus = Schema.Literals(["active", "disabled"]);
export const OAuthGrantType = Schema.Literals([
  "authorization_code",
  "refresh_token",
  "urn:ietf:params:oauth:grant-type:device_code",
]);
export const OAuthResponseType = Schema.Literal("code");
export const OAuthTokenEndpointAuthMethod = Schema.Literal("none");

export const OAuthClient = Schema.Struct({
  id: OAuthClientId,
  clientId: Schema.NonEmptyString,
  registrationType: OAuthClientRegistrationType,
  clientName: Schema.NonEmptyString,
  clientUri: Schema.NullOr(Schema.String),
  logoUri: Schema.NullOr(Schema.String),
  redirectUris: Schema.Array(Schema.NonEmptyString),
  grantTypes: Schema.Array(OAuthGrantType),
  responseTypes: Schema.Array(OAuthResponseType),
  tokenEndpointAuthMethod: OAuthTokenEndpointAuthMethod,
  metadata: Schema.Json,
  status: OAuthClientStatus,
  metadataExpiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const OAuthClientInsert = createInsertSchema(
  OAuthClient,
  "clientId",
  "registrationType",
  "clientName",
  "clientUri",
  "logoUri",
  "redirectUris",
  "grantTypes",
  "responseTypes",
  "tokenEndpointAuthMethod",
  "metadata",
  "status",
  "metadataExpiresAt",
);

export type OAuthClientRegistrationType = typeof OAuthClientRegistrationType.Type;
export type OAuthClientStatus = typeof OAuthClientStatus.Type;
export type OAuthGrantType = typeof OAuthGrantType.Type;
export type OAuthResponseType = typeof OAuthResponseType.Type;
export type OAuthTokenEndpointAuthMethod = typeof OAuthTokenEndpointAuthMethod.Type;
export type OAuthClient = typeof OAuthClient.Type;
export type OAuthClientInsert = typeof OAuthClientInsert.Type;
