import { defineRelationsPart } from "drizzle-orm";

import * as schema from "#/schema/index";

export const notificationRelations = defineRelationsPart(schema, (r) => ({
  notification: {
    // A notification can belong to one organization.
    organization: r.one.organization({
      from: r.notification.organizationId,
      to: r.organization.id,
    }),
    // A notification can be attributed to one organization actor.
    actor: r.one.actor({
      from: [r.notification.actorId, r.notification.organizationId],
      to: [r.actor.id, r.actor.organizationId],
    }),
    // One notification can have many user recipients.
    recipients: r.many.notificationRecipient({
      from: r.notification.id,
      to: r.notificationRecipient.notificationId,
    }),
  },
  notificationRecipient: {
    // Each recipient row belongs to one notification.
    notification: r.one.notification({
      from: r.notificationRecipient.notificationId,
      to: r.notification.id,
      optional: false,
    }),
    // Each recipient row belongs to one user.
    user: r.one.user({
      from: r.notificationRecipient.userId,
      to: r.user.id,
      optional: false,
    }),
    // A recipient row can reference its durable email job.
    emailJob: r.one.emailJob({
      from: r.notificationRecipient.emailJobId,
      to: r.emailJob.id,
    }),
  },
  notificationPreference: {
    // Each notification preference belongs to one user.
    user: r.one.user({
      from: r.notificationPreference.userId,
      to: r.user.id,
      optional: false,
    }),
    // A notification preference can be scoped to one organization.
    organization: r.one.organization({
      from: r.notificationPreference.organizationId,
      to: r.organization.id,
    }),
  },
}));
