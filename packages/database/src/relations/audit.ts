import { defineRelationsPart } from "drizzle-orm";

import * as schema from "#/schema/index";

export const auditRelations = defineRelationsPart(schema, (r) => ({
  betaInviteEvent: {
    // Operator and redemption history remains attached to the retained invite.
    invite: r.one.betaInvite({
      from: r.betaInviteEvent.inviteId,
      to: r.betaInvite.id,
      optional: false,
    }),
  },
  userEvent: {
    // Each user audit event belongs to one user.
    user: r.one.user({ from: r.userEvent.userId, to: r.user.id, optional: false }),
  },
  organizationEvent: {
    // Each organization audit event belongs to one organization.
    organization: r.one.organization({
      from: r.organizationEvent.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // An organization audit event can be attributed to one actor.
    actor: r.one.actor({
      from: [r.organizationEvent.actorId, r.organizationEvent.organizationId],
      to: [r.actor.id, r.actor.organizationId],
    }),
  },
}));
