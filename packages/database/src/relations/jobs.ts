import { defineRelationsPart } from "drizzle-orm";

import * as schema from "#/schema/index";

export const jobRelations = defineRelationsPart(schema, (r) => ({
  emailJob: {
    // An email job can deliver one notification-recipient record.
    notificationRecipient: r.one.notificationRecipient({
      from: r.emailJob.id,
      to: r.notificationRecipient.emailJobId,
    }),
  },
}));
