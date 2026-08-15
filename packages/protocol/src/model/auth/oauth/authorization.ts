import { Schema, Struct } from "effect";

import { ActorId, McpAuthorizationId, OAuthClientId, OrganizationId } from "#/common/index";
import { TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

import { OAuthScopes } from "./common.js";

export const McpAuthorizationStatus = Schema.Literals(["active", "revoked"]);

export const McpAuthorization = Schema.Struct({
  id: McpAuthorizationId,
  organizationId: OrganizationId,
  actorId: ActorId,
  clientId: OAuthClientId,
  authorizedByActorId: ActorId,
  scopes: OAuthScopes,
  resource: Schema.NonEmptyString,
  status: McpAuthorizationStatus,
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedByActorId: Schema.NullOr(ActorId),
  metadata: Schema.Json,
}).mapFields(Struct.assign(TimestampFields));

export const McpAuthorizationInsert = createInsertSchema(
  McpAuthorization,
  "organizationId",
  "actorId",
  "clientId",
  "authorizedByActorId",
  "scopes",
  "resource",
  "status",
  "expiresAt",
  "metadata",
);

export type McpAuthorizationStatus = typeof McpAuthorizationStatus.Type;
export type McpAuthorization = typeof McpAuthorization.Type;
export type McpAuthorizationInsert = typeof McpAuthorizationInsert.Type;
