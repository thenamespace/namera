import type { ActorId, OrganizationId } from "@namera-ai/protocol";
import type { ActorType } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, index, text, uniqueIndex } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "./common.js";
import { organization } from "./organization/organization.js";

export const actor = authSchema.table(
  "actor",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<ActorId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    type: text("type").notNull().$type<ActorType>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("actor_id_organization_uidx").on(table.id, table.organizationId),
    index("actor_organization_type_idx").on(table.organizationId, table.type),
    check("actor_type_check", sql`${table.type} IN ('user')`),
  ],
);
