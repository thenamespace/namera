import { DateTime, Effect, Schema } from "effect";

import { Repository } from "@namera-ai/database";
import type { OrganizationId } from "@namera-ai/protocol";
import type { GetBillingResponse } from "@namera-ai/protocol/dto";
import { FreeBillingRolloutData } from "@namera-ai/protocol/model";

import { resolveBillingPlan } from "./data.js";
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
      const period = yield* periods.current(organizationId, yield* DateTime.now);
      const subscription = yield* repository.billing.subscription.findCurrent(organizationId);
      if (subscription === undefined) {
        return yield* Effect.die("Organization billing subscription is missing");
      }
      const plan = resolveBillingPlan(period);
      const { freeV2RolloutAt } = Schema.decodeUnknownSync(FreeBillingRolloutData)(
        subscription.data,
      );
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
        plan: period.plan,
        planVersion: period.planVersion,
        status: subscription.status,
        ...(plan.version === 1 &&
        freeV2RolloutAt !== undefined &&
        DateTime.toEpochMillis(freeV2RolloutAt) < DateTime.toEpochMillis(period.endsAt)
          ? {
              scheduledChange: {
                plan: "free" as const,
                planVersion: 2,
                effectiveAt: period.endsAt,
              },
            }
          : {}),
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
          ...(plan.version === 2
            ? [
                {
                  key: "oneclaw-wallets" as const,
                  includedAmount: BigInt(plan.resources.maxOneClawWallets),
                  usedAmount: BigInt(usage.oneClawWallets),
                  remainingAmount: remaining(
                    BigInt(plan.resources.maxOneClawWallets),
                    BigInt(usage.oneClawWallets),
                  ),
                },
                {
                  key: "local-session-keys" as const,
                  includedAmount: BigInt(plan.resources.maxLocalSessionKeys),
                  usedAmount: BigInt(usage.localSessionKeys),
                  remainingAmount: remaining(
                    BigInt(plan.resources.maxLocalSessionKeys),
                    BigInt(usage.localSessionKeys),
                  ),
                },
                {
                  key: "oneclaw-session-keys" as const,
                  includedAmount: BigInt(plan.resources.maxOneClawSessionKeys),
                  usedAmount: BigInt(usage.oneClawSessionKeys),
                  remainingAmount: remaining(
                    BigInt(plan.resources.maxOneClawSessionKeys),
                    BigInt(usage.oneClawSessionKeys),
                  ),
                },
              ]
            : []),
        ].filter(
          (resource) =>
            plan.version === 1 || !["software-wallets", "hsm-wallets"].includes(resource.key),
        ),
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
