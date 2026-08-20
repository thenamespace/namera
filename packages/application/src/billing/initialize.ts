import { DateTime, Effect } from "effect";

import type { RepositoryService } from "@namera-ai/database";
import type { OrganizationId } from "@namera-ai/protocol";

import { freeBillingPlan } from "./data.js";

export const initializeOrganizationBilling = Effect.fn("application.initializeOrganizationBilling")(
  function* (
    repository: RepositoryService,
    organizationId: OrganizationId,
    organizationCreatedAt: DateTime.Utc,
  ) {
    yield* repository.billing.account.insert({ organizationId });
    const subscription = yield* repository.billing.subscription.insert({
      organizationId,
      plan: freeBillingPlan.key,
      planVersion: freeBillingPlan.version,
      status: "active",
      data: {},
    });

    const period = yield* repository.billing.period.insert({
      organizationId,
      subscriptionId: subscription.id,
      plan: freeBillingPlan.key,
      planVersion: freeBillingPlan.version,
      startsAt: organizationCreatedAt,
      endsAt: DateTime.add(organizationCreatedAt, {
        months: freeBillingPlan.period.months,
      }),
    });

    yield* repository.billing.meterBalance.insertMany(
      Object.values(freeBillingPlan.meters).map((meter) => ({
        organizationId,
        periodId: period.id,
        meterKey: meter.key,
        meterVersion: meter.version,
        unit: meter.unit,
        includedAmount: meter.includedAmount,
        hardLimitAmount: meter.hardLimitAmount,
      })),
    );
  },
);
