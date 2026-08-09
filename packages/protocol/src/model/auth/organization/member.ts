import { Schema, Struct } from "effect";

import {
  ActorId,
  OrganizationId,
  OrganizationMemberId,
  OrganizationRoleId,
  UserId,
} from "#/common/index";
import { TimestampFields } from "#/model/common";

export const OrganizationMember = Schema.Struct({
  id: OrganizationMemberId,
  actorId: ActorId,
  userId: UserId,
  organizationId: OrganizationId,
  organizationRoleId: OrganizationRoleId,
  joinedAt: Schema.DateTimeUtcFromDate,
  removedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const OrganizationMemberInsert = Schema.Struct({
  actorId: ActorId,
  userId: UserId,
  organizationId: OrganizationId,
  organizationRoleId: OrganizationRoleId,
});

export const OrganizationMemberUpdate = Schema.Struct({
  organizationRoleId: Schema.optionalKey(OrganizationRoleId),
  removedAt: Schema.optionalKey(Schema.NullOr(Schema.DateTimeUtcFromDate)),
});

export type OrganizationMember = typeof OrganizationMember.Type;
export type OrganizationMemberUpdate = typeof OrganizationMemberUpdate.Type;
export type OrganizationMemberInsert = typeof OrganizationMemberInsert.Type;
