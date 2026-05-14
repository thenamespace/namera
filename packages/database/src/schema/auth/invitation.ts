import type {
  Email,
  InvitationStatus,
  OrganizationId,
  OrganizationMemberRole,
  UserId,
} from "@namera-ai/schema";

import { index, text } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "../common";
import { authSchema } from "./common";
import { organization } from "./organization";
import { user } from "./user";

export const invitation = authSchema.table.withRLS(
  "invitation",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId),
    email: text("email").notNull().$type<Email>(),
    role: text("role").notNull().$type<OrganizationMemberRole>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "cascade" }),
    expiresAt: createTimestampField("expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    inviterId: text("inviter_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status")
      .notNull()
      .$type<InvitationStatus>()
      .default("pending"),
    ...timestamps,
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ],
);
