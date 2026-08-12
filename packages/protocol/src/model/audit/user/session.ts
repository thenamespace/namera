import { Schema } from "effect";

import { OrganizationId, SessionId } from "#/common/index";

export const SessionRevokedEventData = Schema.Struct({
  event: Schema.Literal("session.revoked"),
  data: Schema.Struct({
    version: Schema.Literal(1),
    sessionId: SessionId,
  }),
});

export const OtherSessionsRevokedEventData = Schema.Struct({
  event: Schema.Literal("session.others_revoked"),
  data: Schema.Struct({
    version: Schema.Literal(1),
    count: Schema.Int,
  }),
});

export const SessionActiveOrganizationChangedEventData = Schema.Struct({
  event: Schema.Literal("session.active_organization_changed"),
  data: Schema.Struct({
    version: Schema.Literal(1),
    organizationId: OrganizationId,
  }),
});
