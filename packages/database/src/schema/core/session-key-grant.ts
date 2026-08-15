import type { ActorId, OrganizationId, SessionKeyGrantId, SessionKeyId } from "@namera-ai/protocol";
import { sql } from "drizzle-orm";
import { foreignKey, index, text, unique, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId } from "#/schema/common";

import { actor } from "../auth/actor.js";
import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { sessionKey } from "./session-key.js";

export const sessionKeyGrant = coreSchema.table(
  "session_key_grant",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SessionKeyGrantId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    actorId: text("actor_id").notNull().$type<ActorId>(),
    sessionKeyId: text("session_key_id").notNull().$type<SessionKeyId>(),
    grantedByActorId: text("granted_by_actor_id").notNull().$type<ActorId>(),
    revokedAt: createTimestampField("revoked_at"),
    revokedByActorId: text("revoked_by_actor_id").$type<ActorId>(),
    createdAt: createTimestampField("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("session_key_grant_id_organization_unique").on(table.id, table.organizationId),
    unique("session_key_grant_id_actor_organization_unique").on(
      table.id,
      table.actorId,
      table.organizationId,
    ),
    foreignKey({
      name: "session_key_grant_actor_organization_fk",
      columns: [table.actorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "session_key_grant_session_key_organization_fk",
      columns: [table.sessionKeyId, table.organizationId],
      foreignColumns: [sessionKey.id, sessionKey.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "session_key_grant_granter_organization_fk",
      columns: [table.grantedByActorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "session_key_grant_revoker_organization_fk",
      columns: [table.revokedByActorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    uniqueIndex("session_key_grant_active_actor_session_key_uidx")
      .on(table.organizationId, table.actorId, table.sessionKeyId)
      .where(sql`${table.revokedAt} is null`),
    index("session_key_grant_active_session_key_idx")
      .on(table.organizationId, table.sessionKeyId)
      .where(sql`${table.revokedAt} is null`),
    index("session_key_grant_granter_organization_idx").on(
      table.grantedByActorId,
      table.organizationId,
    ),
    index("session_key_grant_revoker_organization_idx").on(
      table.revokedByActorId,
      table.organizationId,
    ),
  ],
);
