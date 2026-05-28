import { Schema, Struct } from "effect";

import {
  OrganizationId,
  OrganizationMemberId,
  OrganizationRoleId,
  UserId,
} from "../../common";
import { TimestampFields } from "../common";
import { createInsertSchema, createUpdateSchema } from "../helpers";

export const OrganizationMember = Schema.Struct({
  id: OrganizationMemberId,
  userId: UserId,
  organizationId: OrganizationId,
  roleId: OrganizationRoleId,
  joinedAt: Schema.DateTimeUtcFromDate,
  removedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const OrganizationMemberUpdate = createUpdateSchema(OrganizationMember);
export const OrganizationMemberInsert = createInsertSchema(
  OrganizationMember,
  "userId",
  "organizationId",
  "roleId",
  "joinedAt",
);

export type OrganizationMember = typeof OrganizationMember.Type;
export type OrganizationMemberUpdate = typeof OrganizationMemberUpdate.Type;
export type OrganizationMemberInsert = typeof OrganizationMemberInsert.Type;
