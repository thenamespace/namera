import { Schema } from "effect";

import { OrganizationId, OrganizationMemberId, UserId } from "@/common";
import { createInsertSchema, createUpdateSchema } from "@/helpers";

export const OrganizationMemberRole = Schema.Literals(["owner", "member"]);

export const OrganizationMember = Schema.Struct({
  id: OrganizationMemberId,
  organizationId: OrganizationId,
  role: OrganizationMemberRole,
  userId: UserId,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export const OrganizationMemberUpdate = createUpdateSchema(OrganizationMember);
export const OrganizationMemberInsert = createInsertSchema(
  OrganizationMember,
  "organizationId",
  "role",
  "userId",
);

export type OrganizationMember = typeof OrganizationMember.Type;
export type OrganizationMemberUpdate = typeof OrganizationMemberUpdate.Type;
export type OrganizationMemberInsert = typeof OrganizationMemberInsert.Type;

export type OrganizationMemberRole = typeof OrganizationMemberRole.Type;
