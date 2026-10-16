import { defineRelationsPart } from "drizzle-orm";

import * as schema from "#/schema/index";

export const jobRelations = defineRelationsPart(schema, (r) => ({
  signingKeyDeactivation: {
    signingKey: r.one.signingKey({
      from: [r.signingKeyDeactivation.signingKeyId, r.signingKeyDeactivation.organizationId],
      to: [r.signingKey.id, r.signingKey.organizationId],
    }),
  },
  emailJob: {
    // An email job can deliver one notification-recipient record.
    notificationRecipient: r.one.notificationRecipient({
      from: r.emailJob.id,
      to: r.notificationRecipient.emailJobId,
    }),
  },
}));
