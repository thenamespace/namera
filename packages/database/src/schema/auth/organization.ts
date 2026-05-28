import type { OrganizationId, UserId } from "@namera-ai/schema";
import type {
  OrganizationMetadata,
  OrganizationPlan,
} from "@namera-ai/schema/database";

import { sql } from "drizzle-orm";
import { index, jsonb, text } from "drizzle-orm/pg-core";

import { adminRole, generateUniqueId, timestamps, userRole } from "../common";
import {
  and,
  onlyActorWithOrgAccess,
  onlyIfNotDeleted,
  PgPolicyBuilder,
} from "../policy";
import { authSchema } from "./common";
import { user } from "./user";

// Organization Table
// Represents an organization
// "insert" policies are not required because they are done by admin
export const organization = authSchema.table.withRLS(
  "organization",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<OrganizationId>(),
    name: text("name").notNull(),
    metadata: jsonb("metadata").notNull().$type<OrganizationMetadata>(),
    plan: text("plan").notNull().$type<OrganizationPlan>(),
    createdById: text("created_by_id")
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("organization_created_by_idx")
      .on(table.createdById)
      .where(sql`${table.deletedAt} IS NULL`),
    new PgPolicyBuilder()
      .name("organization_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(
        and([
          onlyActorWithOrgAccess(table.id),
          onlyIfNotDeleted(table.deletedAt),
        ]),
      )
      .build(),
    new PgPolicyBuilder()
      .name("organization_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(
        and([
          onlyActorWithOrgAccess(table.id),
          onlyIfNotDeleted(table.deletedAt),
        ]),
      )
      .withCheck(
        and([
          onlyActorWithOrgAccess(table.id),
          onlyIfNotDeleted(table.deletedAt),
        ]),
      )
      .build(),
    new PgPolicyBuilder()
      .name("organization_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
