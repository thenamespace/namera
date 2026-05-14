import type {
  OrganizationId,
  OrganizationMemberId,
  UserId,
} from "@namera-ai/schema";

import { index, text } from "drizzle-orm/pg-core";

import { OrganizationMemberRole } from "@namera-ai/schema";

import { generateUniqueId, timestamps } from "../common";
import { authSchema } from "./common";
import { organization } from "./organization";
import { user } from "./user";

export const member = authSchema.table.withRLS(
  "member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<OrganizationMemberId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role")
      .default("member")
      .notNull()
      .$type<OrganizationMemberRole>(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
  ],
);
