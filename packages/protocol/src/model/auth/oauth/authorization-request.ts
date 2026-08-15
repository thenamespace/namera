import { Schema, Struct } from "effect";

import { OAuthAuthorizationRequestId, OAuthClientId, OrganizationId, UserId } from "#/common/index";
import { TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

import { OAuthScopes } from "./common.js";

export const OAuthAuthorizationRequestStatus = Schema.Literals([
  "pending",
  "approved",
  "denied",
  "expired",
]);

export const OAuthAuthorizationRequest = Schema.Struct({
  id: OAuthAuthorizationRequestId,
  clientId: OAuthClientId,
  userId: Schema.NullOr(UserId),
  organizationId: Schema.NullOr(OrganizationId),
  redirectUri: Schema.NonEmptyString,
  responseType: Schema.Literal("code"),
  codeChallenge: Schema.NonEmptyString,
  codeChallengeMethod: Schema.Literal("S256"),
  resource: Schema.NonEmptyString,
  requestedScopes: OAuthScopes,
  state: Schema.NullOr(Schema.String),
  status: OAuthAuthorizationRequestStatus,
  expiresAt: Schema.DateTimeUtcFromDate,
  approvedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  deniedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const OAuthAuthorizationRequestInsert = createInsertSchema(
  OAuthAuthorizationRequest,
  "clientId",
  "redirectUri",
  "responseType",
  "codeChallenge",
  "codeChallengeMethod",
  "resource",
  "requestedScopes",
  "state",
  "status",
  "expiresAt",
);

export type OAuthAuthorizationRequestStatus = typeof OAuthAuthorizationRequestStatus.Type;
export type OAuthAuthorizationRequest = typeof OAuthAuthorizationRequest.Type;
export type OAuthAuthorizationRequestInsert = typeof OAuthAuthorizationRequestInsert.Type;
