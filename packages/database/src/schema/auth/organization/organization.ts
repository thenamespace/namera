import type { OrganizationId, UserId } from "@namera-ai/protocol";
import type { OrganizationMetadata, OrganizationPlan } from "@namera-ai/protocol/model";
import { text, jsonb } from "drizzle-orm/pg-core";
import { index } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";
import { user } from "../core/index.js";

export const organization = authSchema.table(
  "organization",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<OrganizationId>(),
    metadata: jsonb("metadata").notNull().$type<OrganizationMetadata>(),
    plan: text("plan").notNull().default("free").$type<OrganizationPlan>(),
    createdById: text("created_by_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    index("organization_created_by_idx").on(table.createdById),
    index("organization_plan_idx").on(table.plan),
  ],
);
