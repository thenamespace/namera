import { DateTime, Effect } from "effect";

import { Repository } from "@namera-ai/database";
import type { OrganizationId } from "@namera-ai/protocol";
import type { GetBillingResponse } from "@namera-ai/protocol/dto";

import { resolveBillingPlan } from "./helpers.js";
import { makeBillingPeriods } from "./periods.js";
import { makeBillingReconciliation } from "./reconciliation.js";

export interface BillingApplication {
  readonly get: (organizationId: OrganizationId) => Effect.Effect<GetBillingResponse>;
  readonly reconcileSponsorships: () => Effect.Effect<number>;
  readonly reconcile: () => Effect.Effect<{
    readonly rolledOver: number;
    readonly recovered: number;
    readonly repaired: number;
  }>;
}

const remaining = (limit: bigint, used: bigint) => (used >= limit ? 0n : limit - used);

export const makeBillingApplication = Effect.gen(function* () {
  const repository = yield* Repository;
  const periods = yield* makeBillingPeriods;
  const reconciliation = yield* makeBillingReconciliation;

  const get = Effect.fn("application.billing.get")(
    function* (organizationId: OrganizationId) {
      const subscription = yield* repository.billing.subscription.findCurrent(organizationId);
      if (subscription === undefined) {
        return yield* Effect.die("Organization billing subscription is missing");
      }
      const plan = resolveBillingPlan(subscription);
      const period = yield* periods.current(organizationId, yield* DateTime.now);
      const balances = yield* repository.billing.meterBalance.listForPeriod(
        organizationId,
        period.id,
      );
      const usage = yield* repository.billing.usage.getForOrganization(
        organizationId,
        yield* DateTime.now,
      );
      return {
        organizationId,
        plan: subscription.plan,
        planVersion: subscription.planVersion,
        status: subscription.status,
        period: { id: period.id, startsAt: period.startsAt, endsAt: period.endsAt },
        resources: [
          {
            key: "members" as const,
            includedAmount: BigInt(plan.resources.maxMembers),
            usedAmount: BigInt(usage.members + usage.pendingInvitations),
            remainingAmount: remaining(
              BigInt(plan.resources.maxMembers),
              BigInt(usage.members + usage.pendingInvitations),
            ),
          },
          {
            key: "software-wallets" as const,
            includedAmount: BigInt(plan.resources.maxSoftwareWallets),
            usedAmount: BigInt(usage.softwareWallets),
            remainingAmount: remaining(
              BigInt(plan.resources.maxSoftwareWallets),
              BigInt(usage.softwareWallets),
            ),
          },
          {
            key: "hsm-wallets" as const,
            includedAmount: BigInt(plan.resources.maxHsmWallets),
            usedAmount: BigInt(usage.hsmWallets),
            remainingAmount: remaining(
              BigInt(plan.resources.maxHsmWallets),
              BigInt(usage.hsmWallets),
            ),
          },
          {
            key: "local-wallets" as const,
            includedAmount: BigInt(plan.resources.maxLocalWallets),
            usedAmount: BigInt(usage.localWallets),
            remainingAmount: remaining(
              BigInt(plan.resources.maxLocalWallets),
              BigInt(usage.localWallets),
            ),
          },
        ],
        meters: balances.map((balance) => ({
          key: balance.meterKey,
          unit: balance.unit,
          includedAmount: balance.includedAmount,
          hardLimitAmount: balance.hardLimitAmount,
          consumedAmount: balance.consumedAmount,
          reservedAmount: balance.reservedAmount,
          remainingAmount:
            balance.hardLimitAmount === null
              ? null
              : remaining(balance.hardLimitAmount, balance.consumedAmount + balance.reservedAmount),
        })),
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
  const reconcile = Effect.fn("application.billing.reconcile")(
    reconciliation.run,
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const reconcileSponsorships = Effect.fn("application.billing.reconcileSponsorships")(
    reconciliation.reconcileSponsorships,
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { get, reconcile, reconcileSponsorships } satisfies BillingApplication;
});
