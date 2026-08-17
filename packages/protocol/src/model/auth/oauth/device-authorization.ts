import { Schema, Struct } from "effect";

import {
  OAuthAuthorizationId,
  OAuthClientId,
  OAuthDeviceAuthorizationId,
  OrganizationId,
  UserId,
} from "#/common/index";
import { TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

import { OAuthScopes } from "./common.js";

export const OAuthDeviceAuthorizationStatus = Schema.Literals([
  "pending",
  "approved",
  "denied",
  "consumed",
  "expired",
]);

export const OAuthDeviceAuthorizationMetadata = Schema.Struct({
  version: Schema.Literal(1),
  deviceName: Schema.NonEmptyString,
  cliVersion: Schema.NonEmptyString,
  platform: Schema.NonEmptyString,
});

export const OAuthDeviceAuthorization = Schema.Struct({
  id: OAuthDeviceAuthorizationId,
  clientId: OAuthClientId,
  deviceCodeHash: Schema.NonEmptyString,
  userCodeHmac: Schema.NonEmptyString,
  claimedByUserId: Schema.NullOr(UserId),
  organizationId: Schema.NullOr(OrganizationId),
  authorizationId: Schema.NullOr(OAuthAuthorizationId),
  requestedScopes: OAuthScopes,
  resource: Schema.NonEmptyString,
  status: OAuthDeviceAuthorizationStatus,
  pollingIntervalSeconds: Schema.Int.check(Schema.isGreaterThanOrEqualTo(5)),
  lastPolledAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  expiresAt: Schema.DateTimeUtcFromDate,
  approvedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  deniedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  consumedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  metadata: OAuthDeviceAuthorizationMetadata,
}).mapFields(Struct.assign(TimestampFields));

export const OAuthDeviceAuthorizationInsert = createInsertSchema(
  OAuthDeviceAuthorization,
  "clientId",
  "deviceCodeHash",
  "userCodeHmac",
  "requestedScopes",
  "resource",
  "status",
  "pollingIntervalSeconds",
  "expiresAt",
  "metadata",
);

export type OAuthDeviceAuthorizationStatus = typeof OAuthDeviceAuthorizationStatus.Type;
export type OAuthDeviceAuthorizationMetadata = typeof OAuthDeviceAuthorizationMetadata.Type;
export type OAuthDeviceAuthorization = typeof OAuthDeviceAuthorization.Type;
export type OAuthDeviceAuthorizationInsert = typeof OAuthDeviceAuthorizationInsert.Type;
