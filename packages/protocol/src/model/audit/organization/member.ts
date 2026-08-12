import { Schema } from "effect";

import { OrganizationMemberId, OrganizationRoleId, UserId } from "#/common/index";

const MemberResource = {
  resourceType: Schema.Literal("member"),
  resourceId: OrganizationMemberId,
};

export const MemberCreatedEventData = Schema.Struct({
  event: Schema.Literal("member.created"),
  ...MemberResource,
  data: Schema.Struct({
    version: Schema.Literal(1),
    userId: UserId,
    organizationRoleId: OrganizationRoleId,
  }),
});
