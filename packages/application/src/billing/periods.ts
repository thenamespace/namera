import { DateTime, Effect, Metric, Schema } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import type { OrganizationId } from "@namera-ai/protocol";
import type { BillingPeriod } from "@namera-ai/protocol/model";
import { FreeBillingRolloutData } from "@namera-ai/protocol/model";
import { billingPeriodRollovers } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";

import { freeBillingPlan, resolveBillingPlan } from "./data.js";
import { lockOrganizationBilling } from "./lock.js";

const isBefore = (left: DateTime.Utc, right: DateTime.Utc) =>
  DateTime.toEpochMillis(left) < DateTime.toEpochMillis(right);

const contains = (period: BillingPeriod, at: DateTime.Utc) =>
  !isBefore(at, period.startsAt) && isBefore(at, period.endsAt);

export const makeBillingPeriods = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const audit = yield* Audit;

  const createBalances = Effect.fnUntraced(function* (period: BillingPeriod) {
    const plan = resolveBillingPlan(period);
    yield* repository.billing.meterBalance.insertMany(
      Object.values(plan.meters).map((meter) => ({
        organizationId: period.organizationId,
        periodId: period.id,
        meterKey: meter.key,
        meterVersion: meter.version,
        unit: meter.unit,
        includedAmount: meter.includedAmount,
        hardLimitAmount: meter.hardLimitAmount,
      })),
    );
  });

  const current = Effect.fn("application.billing.periods.current")(function* (
    organizationId: OrganizationId,
    at: DateTime.Utc,
  ) {
    return yield* transaction.run(
      Effect.gen(function* () {
        yield* lockOrganizationBilling(repository, organizationId);

        const subscription = yield* repository.billing.subscription.findCurrent(organizationId);
        if (subscription === undefined) {
          return yield* Effect.die("Organization billing subscription is missing");
        }
        let plan = resolveBillingPlan(subscription);
        const { freeV2RolloutAt } = Schema.decodeUnknownSync(FreeBillingRolloutData)(
          subscription.data,
        );
        const existing = yield* repository.billing.period.findContaining(organizationId, at);
        if (existing !== undefined) return existing;

        let open = yield* repository.billing.period.findOpen(organizationId);
        if (open === undefined) {
          return yield* Effect.die("Organization billing period is missing");
        }
        if (contains(open, at)) return open;
        if (isBefore(at, open.startsAt)) {
          // Database timestamps use the server clock while deterministic tests
          // can install an Effect TestClock a few milliseconds behind it.
          // The only open period is still the authoritative current period.
          return open;
        }

        const history = yield* repository.billing.period.listForSubscription(
          organizationId,
          subscription.id,
        );
        const anchor = history.at(-1)?.startsAt;
        if (anchor === undefined) return yield* Effect.die("Billing anniversary anchor is missing");

        let periodCount = history.length;
        while (!contains(open, at)) {
          if (
            plan.version === 1 &&
            freeV2RolloutAt !== undefined &&
            isBefore(freeV2RolloutAt, open.endsAt)
          ) {
            const upgraded = yield* repository.billing.subscription.upgradeFreeV2(organizationId);
            if (!upgraded) return yield* Effect.die("Free plan transition failed");
            plan = freeBillingPlan;
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
                  effectiveAt: open.endsAt,
                },
              },
              { source: "system" },
            );
          }
          const closed = yield* repository.billing.period.close(organizationId, open.id, at);
          if (closed === undefined) return yield* Effect.die("Billing period could not be closed");

          periodCount += 1;
          open = yield* repository.billing.period.insert({
            organizationId,
            subscriptionId: subscription.id,
            plan: plan.key,
            planVersion: plan.version,
            startsAt: open.endsAt,
            // Always calculate from the original anniversary. Adding one month
            // repeatedly would permanently shift a Jan 31 organization to the
            // 28th after February.
            endsAt: DateTime.add(anchor, { months: periodCount }),
          });
          yield* createBalances(open);
          yield* Metric.update(billingPeriodRollovers, 1);
        }

        return open;
      }),
    );
  });

  const rolloverExpired = Effect.fn("application.billing.periods.rolloverExpired")(function* (
    limit = 50,
  ) {
    const now = yield* DateTime.now;
    const periods = yield* repository.billing.period.listExpiredOpen(now, limit);
    yield* Effect.forEach(periods, (period) => current(period.organizationId, now), {
      concurrency: 5,
      discard: true,
    });
    return periods.length;
  });

  return { current, rolloverExpired } as const;
});
