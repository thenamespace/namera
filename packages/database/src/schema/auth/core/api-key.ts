import type { ActorId, ApiKeyId, OrganizationId } from "@namera-ai/protocol";
import type { ApiKey } from "@namera-ai/protocol/model";
import { foreignKey, index, jsonb, text, unique, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { actor } from "../actor.js";
import { authSchema } from "../common.js";
import { organization } from "../organization/organization.js";

export const apiKey = authSchema.table(
  "api_key",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<ApiKeyId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    actorId: text("actor_id").notNull().$type<ActorId>(),
    createdByActorId: text("created_by_actor_id").notNull().$type<ActorId>(),
    metadata: jsonb("metadata").notNull().$type<ApiKey["metadata"]>(),
    keyHash: text("key_hash").notNull(),
    keyStart: text("key_start").notNull(),
    expiresAt: createTimestampField("expires_at"),
    lastUsedAt: createTimestampField("last_used_at"),
    revokedAt: createTimestampField("revoked_at"),
    revokedByActorId: text("revoked_by_actor_id").$type<ActorId>(),
    ...timestamps,
  },
  (table) => [
    unique("api_key_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("api_key_actor_uidx").on(table.actorId),
    uniqueIndex("api_key_hash_uidx").on(table.keyHash),
    foreignKey({
      name: "api_key_actor_organization_fk",
      columns: [table.actorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "api_key_creator_organization_fk",
      columns: [table.createdByActorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "api_key_revoker_organization_fk",
      columns: [table.revokedByActorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    index("api_key_organization_created_idx").on(table.organizationId, table.createdAt),
    index("api_key_organization_last_used_idx").on(table.organizationId, table.lastUsedAt),
  ],
);
