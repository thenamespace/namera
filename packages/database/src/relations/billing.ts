import { defineRelationsPart } from "drizzle-orm";

import * as schema from "#/schema/index";

export const billingRelations = defineRelationsPart(schema, (r) => ({
  billingAccount: {
    // Each billing account belongs to one organization.
    organization: r.one.organization({
      from: r.billingAccount.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // One billing account can retain many subscription records.
    subscriptions: r.many.billingSubscription({
      from: r.billingAccount.organizationId,
      to: r.billingSubscription.organizationId,
    }),
  },
  billingSubscription: {
    // Each billing subscription belongs to one billing account.
    account: r.one.billingAccount({
      from: r.billingSubscription.organizationId,
      to: r.billingAccount.organizationId,
      optional: false,
    }),
    // Each billing subscription belongs to one organization.
    organization: r.one.organization({
      from: r.billingSubscription.organizationId,
      to: r.organization.id,
      optional: false,
    }),
  },
}));
