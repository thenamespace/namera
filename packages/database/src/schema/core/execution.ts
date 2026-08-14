import type { ExecutionId, OrganizationId, SessionKeyGrantId } from "@namera-ai/protocol";
import type { Execution, ExecutionEncoded } from "@namera-ai/protocol/model";
import { foreignKey, index, jsonb, text } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId } from "#/schema/common";

import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { sessionKeyGrant } from "./session-key-grant.js";

export const execution = coreSchema.table(
  "execution",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<ExecutionId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    sessionKeyGrantId: text("session_key_grant_id").notNull().$type<SessionKeyGrantId>(),
    namespace: text("namespace").notNull().$type<Execution["namespace"]>(),
    data: jsonb("data").notNull().$type<ExecutionEncoded["data"]>(),
    createdAt: createTimestampField("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "execution_session_key_grant_organization_fk",
      columns: [table.sessionKeyGrantId, table.organizationId],
      foreignColumns: [sessionKeyGrant.id, sessionKeyGrant.organizationId],
    }).onDelete("restrict"),
    index("execution_organization_created_at_idx").on(table.organizationId, table.createdAt),
    index("execution_session_key_grant_created_at_idx").on(
      table.organizationId,
      table.sessionKeyGrantId,
      table.createdAt,
    ),
  ],
);
