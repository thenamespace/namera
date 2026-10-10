import { DateTime, Effect } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";

import { Audit } from "#/audit/layer";

import { freeBillingPlan } from "./data.js";
import { lockOrganizationBilling } from "./lock.js";
import { makeBillingPeriods } from "./periods.js";

// Temporary startup operation; no HTTP endpoint. Version 2 is the durable skip marker.
export const upgradeExistingFreeSubscriptions = Effect.fn(
  "application.billing.upgradeExistingFreeSubscriptions",
)(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const audit = yield* Audit;
  const periods = yield* makeBillingPeriods;
  const candidates = yield* repository.billing.subscription.listFreeV1();
  let upgraded = 0;

  for (const candidate of candidates) {
    const changed = yield* transaction.run(
      Effect.gen(function* () {
        const organizationId = candidate.organizationId;
        yield* lockOrganizationBilling(repository, organizationId);
        const subscription = yield* repository.billing.subscription.findCurrent(organizationId);
        if (subscription?.id !== candidate.id || subscription.planVersion !== 1) return false;

        const now = yield* DateTime.now;
        // Close overdue periods normally first; never rewrite historical balances.
        const period = yield* periods.current(organizationId, now);
        if (period.planVersion === 2) return true;
        yield* repository.billing.subscription.applyFreeV2ToCurrentPeriod(
          period,
          Object.values(freeBillingPlan.meters),
          now,
        );
        yield* audit.organization(
          {
            organizationId,
            actorId: null,
            event: "billing.plan_changed",
            resourceType: "organization",
            resourceId: organizationId,
            data: {
              version: 1,
              plan: "free",
              previousPlanVersion: 1,
              planVersion: 2,
              effectiveAt: now,
            },
          },
          { source: "system" },
        );
        return true;
      }),
    );
    if (changed) upgraded += 1;
  }
  return { upgraded, skipped: candidates.length - upgraded };
});
