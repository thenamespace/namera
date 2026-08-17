import type {
  ActorId,
  OAuthAuthorizationId,
  OAuthClientId,
  OrganizationId,
} from "@namera-ai/protocol";
import type {
  OAuthAuthorization,
  OAuthAuthorizationStatus,
  OAuthAuthorizationType,
} from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, text, unique, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { actor } from "../actor.js";
import { authSchema } from "../common.js";
import { organization } from "../organization/organization.js";
import { oauthClient } from "./client.js";

export const oauthAuthorization = authSchema.table(
  "oauth_authorization",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<OAuthAuthorizationId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    actorId: text("actor_id").notNull().$type<ActorId>(),
    clientId: text("client_id")
      .notNull()
      .$type<OAuthClientId>()
      .references(() => oauthClient.id, { onDelete: "restrict" }),
    type: text("type").notNull().$type<OAuthAuthorizationType>(),
    authorizedByActorId: text("authorized_by_actor_id").notNull().$type<ActorId>(),
    scopes: jsonb("scopes").notNull().$type<OAuthAuthorization["scopes"]>(),
    resource: text("resource").notNull(),
    status: text("status").notNull().$type<OAuthAuthorizationStatus>(),
    expiresAt: createTimestampField("expires_at"),
    lastUsedAt: createTimestampField("last_used_at"),
    revokedAt: createTimestampField("revoked_at"),
    revokedByActorId: text("revoked_by_actor_id").$type<ActorId>(),
    metadata: jsonb("metadata").notNull().$type<OAuthAuthorization["metadata"]>(),
    ...timestamps,
  },
  (table) => [
    unique("oauth_authorization_id_client_unique").on(table.id, table.clientId),
    unique("oauth_authorization_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("oauth_authorization_actor_uidx").on(table.actorId),
    foreignKey({
      name: "oauth_authorization_actor_organization_fk",
      columns: [table.actorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "oauth_authorization_authorizer_organization_fk",
      columns: [table.authorizedByActorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "oauth_authorization_revoker_organization_fk",
      columns: [table.revokedByActorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    index("oauth_authorization_organization_created_idx").on(table.organizationId, table.createdAt),
    index("oauth_authorization_client_status_idx").on(table.clientId, table.status),
    check("oauth_authorization_type_check", sql`${table.type} IN ('mcp', 'cli')`),
    check("oauth_authorization_status_check", sql`${table.status} IN ('active', 'revoked')`),
  ],
);
