import { Schema } from "effect";

import { InvitationId, OrganizationMemberId, UserId } from "#/common/index";

const InvitationResource = {
  resourceType: Schema.Literal("invitation"),
  resourceId: InvitationId,
};

export const InvitationCreatedEventData = Schema.Struct({
  event: Schema.Literal("invitation.created"),
  ...InvitationResource,
  data: Schema.Struct({
    version: Schema.Literal(1),
  }),
});

export const InvitationAcceptedEventData = Schema.Struct({
  event: Schema.Literal("invitation.accepted"),
  ...InvitationResource,
  data: Schema.Struct({
    version: Schema.Literal(1),
    organizationMemberId: OrganizationMemberId,
  }),
});

export const InvitationRejectedEventData = Schema.Struct({
  event: Schema.Literal("invitation.rejected"),
  ...InvitationResource,
  data: Schema.Struct({
    version: Schema.Literal(1),
    userId: UserId,
  }),
});

export const InvitationCanceledEventData = Schema.Struct({
  event: Schema.Literal("invitation.canceled"),
  ...InvitationResource,
  data: Schema.Struct({
    version: Schema.Literal(1),
  }),
});
