import type {
  Email,
  InvitationStatus,
  OrganizationId,
  OrganizationMemberRole,
  UserId,
} from "@namera-ai/schema";

import { index, text } from "drizzle-orm/pg-core";

import {
  adminRole,
  createTimestampField,
  generateUniqueId,
  timestamps,
  userRole,
} from "../common";
import {
  onlyOrgMember,
  onlyOrgMemberWithRoles,
  PgPolicyBuilder,
} from "../policy";
import { authSchema } from "./common";
import { organization } from "./organization";
import { user } from "./user";

// Invitations table
// Represents an invitation to join an organization
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
    inviterId: text("inviter_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status")
      .notNull()
      .$type<InvitationStatus>()
      .default("pending"),
    expiresAt: createTimestampField("expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
    // Users can only select their own invitations
    new PgPolicyBuilder()
      .name("invitation_user_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(onlyOrgMember(table.organizationId))
      .build(),
    // Only Org owner can create invitations
    new PgPolicyBuilder()
      .name("invitation_owner_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(onlyOrgMemberWithRoles(table.organizationId, ["owner"]))
      .build(),
    // Only Org owner can update invitations
    new PgPolicyBuilder()
      .name("invitation_owner_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(onlyOrgMemberWithRoles(table.organizationId, ["owner"]))
      .withCheck(onlyOrgMemberWithRoles(table.organizationId, ["owner"]))
      .build(),
    // Only Org owner can delete invitations
    new PgPolicyBuilder()
      .name("invitation_owner_delete")
      .as("permissive")
      .to(userRole)
      .forOperation("delete")
      .using(onlyOrgMemberWithRoles(table.organizationId, ["owner"]))
      .build(),
    // Admins can access all invitations
    new PgPolicyBuilder()
      .name("invitation_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using("true")
      .build(),
  ],
);
