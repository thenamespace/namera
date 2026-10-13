import type { OrganizationId, UserId } from "@namera-ai/protocol";
import type { Feedback } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, index, jsonb, text } from "drizzle-orm/pg-core";

import { user } from "#/schema/auth/core/user";
import { organization } from "#/schema/auth/organization/organization";
import { generateUniqueId, timestamps } from "#/schema/common";

import { coreSchema } from "./common.js";

export const feedback = coreSchema.table(
  "feedback",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "restrict" }),
    organizationId: text("organization_id")
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    category: text("category").notNull().$type<Feedback["category"]>(),
    data: jsonb("data").notNull().$type<Feedback["data"]>(),
    status: text("status").notNull().$type<Feedback["status"]>().default("new"),
    pagePath: text("page_path"),
    ...timestamps,
  },
  (table) => [
    index("feedback_status_id_idx").on(table.status, table.id),
    index("feedback_category_id_idx").on(table.category, table.id),
    index("feedback_user_idx").on(table.userId),
    index("feedback_organization_idx").on(table.organizationId),
    check(
      "feedback_category_check",
      sql`${table.category} in ('bug', 'feature_request', 'general')`,
    ),
    check(
      "feedback_status_check",
      sql`${table.status} in ('new', 'in_review', 'planned', 'completed', 'closed')`,
    ),
    check(
      "feedback_data_check",
      sql`jsonb_typeof(${table.data}) = 'object' AND ${table.data} ? 'version' AND jsonb_typeof(${table.data}->'version') = 'number' AND (${table.data}->>'version')::numeric >= 1`,
    ),
    check(
      "feedback_page_path_check",
      sql`${table.pagePath} is null OR (length(${table.pagePath}) <= 500 AND ${table.pagePath} ~ '^/([^/?#[:space:]][^?#[:space:]]*)?$')`,
    ),
  ],
);
