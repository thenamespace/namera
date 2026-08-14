import { Effect } from "effect";

import type { RepositoryService } from "@namera-ai/database";
import type { OrganizationId } from "@namera-ai/protocol";

import { billingPlans } from "./data.js";

export const initializeOrganizationBilling = Effect.fn("application.initializeOrganizationBilling")(
  function* (repository: RepositoryService, organizationId: OrganizationId) {
    yield* repository.billing.account.insert({ organizationId });
    yield* repository.billing.subscription.insert({
      organizationId,
      plan: "free",
      planVersion: billingPlans.free.version,
      status: "active",
      data: {},
    });
  },
);
