import { Schema } from "effect";

import {
  OrganizationId,
  OrganizationMemberId,
  OrganizationRoleId,
  UserId,
} from "@/common";
import { createInsertSchema, createUpdateSchema } from "@/helpers";

export const OrganizationMember = Schema.Struct({
  id: OrganizationMemberId,
  organizationId: OrganizationId,
  roleId: OrganizationRoleId,
  userId: UserId,
  joinedAt: Schema.Date,
  removedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  deletedAt: Schema.NullOr(Schema.Date),
});

export const OrganizationMemberUpdate = createUpdateSchema(OrganizationMember);
export const OrganizationMemberInsert = createInsertSchema(
  OrganizationMember,
  "organizationId",
  "roleId",
  "userId",
);

export type OrganizationMember = typeof OrganizationMember.Type;
export type OrganizationMemberUpdate = typeof OrganizationMemberUpdate.Type;
export type OrganizationMemberInsert = typeof OrganizationMemberInsert.Type;
