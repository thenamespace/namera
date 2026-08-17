import { Schema, Struct } from "effect";

import { ActorId, OAuthAuthorizationId, OAuthClientId, OrganizationId } from "#/common/index";
import { TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

import { OAuthScopes } from "./common.js";

export const OAuthAuthorizationType = Schema.Literals(["mcp", "cli"]);
export const OAuthAuthorizationStatus = Schema.Literals(["active", "revoked"]);

export const OAuthAuthorizationMetadata = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("mcp"),
    version: Schema.Literal(1),
  }),
  Schema.Struct({
    type: Schema.Literal("cli"),
    version: Schema.Literal(1),
    deviceName: Schema.NonEmptyString,
    cliVersion: Schema.NonEmptyString,
    platform: Schema.NonEmptyString,
  }),
]);

export const OAuthAuthorization = Schema.Struct({
  id: OAuthAuthorizationId,
  organizationId: OrganizationId,
  actorId: ActorId,
  clientId: OAuthClientId,
  type: OAuthAuthorizationType,
  authorizedByActorId: ActorId,
  scopes: OAuthScopes,
  resource: Schema.NonEmptyString,
  status: OAuthAuthorizationStatus,
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedByActorId: Schema.NullOr(ActorId),
  metadata: OAuthAuthorizationMetadata,
}).mapFields(Struct.assign(TimestampFields));

export const OAuthAuthorizationInsert = createInsertSchema(
  OAuthAuthorization,
  "organizationId",
  "actorId",
  "clientId",
  "type",
  "authorizedByActorId",
  "scopes",
  "resource",
  "status",
  "expiresAt",
  "metadata",
);

export type OAuthAuthorizationStatus = typeof OAuthAuthorizationStatus.Type;
export type OAuthAuthorizationType = typeof OAuthAuthorizationType.Type;
export type OAuthAuthorizationMetadata = typeof OAuthAuthorizationMetadata.Type;
export type OAuthAuthorization = typeof OAuthAuthorization.Type;
export type OAuthAuthorizationInsert = typeof OAuthAuthorizationInsert.Type;
