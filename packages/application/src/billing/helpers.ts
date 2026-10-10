import { DateTime, Effect } from "effect";

import type { RepositoryService } from "@namera-ai/database";
import { BillingLimitExceededError, type OrganizationId } from "@namera-ai/protocol";
import type { BillingSubscription, WalletKeyProtectionLevel } from "@namera-ai/protocol/model";

import { resolveBillingPlan, type FreeBillingPlan } from "./data.js";
import type { makeBillingPeriods } from "./periods.js";
export { lockOrganizationBilling } from "./lock.js";

export interface OrganizationBillingSnapshot {
  readonly subscription: BillingSubscription;
  readonly limits: FreeBillingPlan["resources"];
  readonly usage: {
    readonly members: number;
    readonly pendingInvitations: number;
    readonly softwareWallets: number;
    readonly hsmWallets: number;
    readonly localWallets: number;
    readonly oneClawWallets: number;
    readonly localSessionKeys: number;
    readonly oneClawSessionKeys: number;
  };
}

export const loadOrganizationBilling = Effect.fnUntraced(function* (
  repository: RepositoryService,
  organizationId: OrganizationId,
  periods: Effect.Success<typeof makeBillingPeriods>,
) {
  yield* periods.current(organizationId, yield* DateTime.now);
  const subscription = yield* repository.billing.subscription.findCurrent(organizationId);
  if (!subscription) {
    return yield* Effect.die("Organization billing subscription is missing");
  }
  const plan = resolveBillingPlan(subscription);
  const usage = yield* repository.billing.usage.getForOrganization(
    organizationId,
    yield* DateTime.now,
  );
  const result: OrganizationBillingSnapshot = { subscription, limits: plan.resources, usage };
  return result;
});

export const enforceOneClawWalletLimit = Effect.fn("application.enforceOneClawWalletLimit")(
  function* (
    repository: RepositoryService,
    organizationId: OrganizationId,
    periods: Effect.Success<typeof makeBillingPeriods>,
  ) {
    const { limits, usage } = yield* loadOrganizationBilling(repository, organizationId, periods);
    if (usage.oneClawWallets >= limits.maxOneClawWallets)
      return yield* new BillingLimitExceededError({
        code: "LIMIT_EXCEEDED",
        limit: "oneClawWallets",
      });
  },
);

export const enforceSessionKeyLimit = Effect.fn("application.enforceSessionKeyLimit")(function* (
  repository: RepositoryService,
  organizationId: OrganizationId,
  provider: "local" | "1claw",
  periods: Effect.Success<typeof makeBillingPeriods>,
) {
  const { limits, usage } = yield* loadOrganizationBilling(repository, organizationId, periods);
  const limit = provider === "local" ? limits.maxLocalSessionKeys : limits.maxOneClawSessionKeys;
  const used = provider === "local" ? usage.localSessionKeys : usage.oneClawSessionKeys;
  if (limit !== null && used >= limit)
    return yield* new BillingLimitExceededError({
      code: "LIMIT_EXCEEDED",
      limit: provider === "local" ? "localSessionKeys" : "oneClawSessionKeys",
    });
});

export const enforceMemberLimit = Effect.fn("application.enforceMemberLimit")(function* (
  repository: RepositoryService,
  organizationId: OrganizationId,
  periods: Effect.Success<typeof makeBillingPeriods>,
) {
  const { limits, usage } = yield* loadOrganizationBilling(repository, organizationId, periods);
  if (usage.members + usage.pendingInvitations >= limits.maxMembers) {
    return yield* new BillingLimitExceededError({
      code: "LIMIT_EXCEEDED",
      limit: "members",
    });
  }
});

export const enforceWalletLimit = Effect.fn("application.enforceWalletLimit")(function* (
  repository: RepositoryService,
  organizationId: OrganizationId,
  protectionLevel: WalletKeyProtectionLevel,
  periods: Effect.Success<typeof makeBillingPeriods>,
) {
  const { limits, usage } = yield* loadOrganizationBilling(repository, organizationId, periods);
  if (protectionLevel === "software" && usage.softwareWallets >= limits.maxSoftwareWallets) {
    return yield* new BillingLimitExceededError({
      code: "LIMIT_EXCEEDED",
      limit: "softwareWallets",
    });
  }
  if (protectionLevel === "hsm" && usage.hsmWallets >= limits.maxHsmWallets) {
    return yield* new BillingLimitExceededError({
      code: "LIMIT_EXCEEDED",
      limit: "hsmWallets",
    });
  }
});

export const enforceLocalWalletLimit = Effect.fn("application.enforceLocalWalletLimit")(function* (
  repository: RepositoryService,
  organizationId: OrganizationId,
  periods: Effect.Success<typeof makeBillingPeriods>,
) {
  const { limits, usage } = yield* loadOrganizationBilling(repository, organizationId, periods);
  if (usage.localWallets >= limits.maxLocalWallets) {
    return yield* new BillingLimitExceededError({
      code: "LIMIT_EXCEEDED",
      limit: "localWallets",
    });
  }
});
