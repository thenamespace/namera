import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import type { OrganizationId } from "@namera-ai/protocol";
import type { GetBillingResponse } from "@namera-ai/protocol/dto";

import { loadOrganizationBilling } from "./helpers.js";

export interface BillingApplication {
  readonly get: (organizationId: OrganizationId) => Effect.Effect<GetBillingResponse>;
}

export const makeBillingApplication = Effect.gen(function* () {
  const repository = yield* Repository;

  const get = Effect.fn("application.billing.get")(
    function* (organizationId: OrganizationId) {
      const { subscription, limits, usage } = yield* loadOrganizationBilling(
        repository,
        organizationId,
      );
      return {
        organizationId,
        plan: subscription.plan,
        planVersion: subscription.planVersion,
        status: subscription.status,
        limits,
        usage,
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { get } satisfies BillingApplication;
});
