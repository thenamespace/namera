import { DateTime, Effect } from "effect";

import type { RepositoryService } from "@namera-ai/database";
import { BillingLimitExceededError, type OrganizationId } from "@namera-ai/protocol";
import type { BillingSubscription, WalletKeyProtectionLevel } from "@namera-ai/protocol/model";

import { freeBillingPlan } from "./data.js";

export interface OrganizationBillingSnapshot {
  readonly subscription: BillingSubscription;
  readonly limits: typeof freeBillingPlan.resources;
  readonly usage: {
    readonly members: number;
    readonly pendingInvitations: number;
    readonly softwareWallets: number;
    readonly hsmWallets: number;
  };
}

export const resolveBillingPlan = (subscription: BillingSubscription) => {
  if (
    subscription.plan !== freeBillingPlan.key ||
    subscription.planVersion !== freeBillingPlan.version
  ) {
    throw new Error(
      `Unsupported billing plan version: ${subscription.plan}@${subscription.planVersion}`,
    );
  }
  return freeBillingPlan;
};

export const lockOrganizationBilling = Effect.fn("application.lockOrganizationBilling")(function* (
  repository: RepositoryService,
  organizationId: OrganizationId,
) {
  const account = yield* repository.billing.account.lockByOrganizationId(organizationId);
  if (!account) {
    return yield* Effect.die("Organization billing account is missing");
  }
});

export const loadOrganizationBilling = Effect.fnUntraced(function* (
  repository: RepositoryService,
  organizationId: OrganizationId,
) {
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

export const enforceMemberLimit = Effect.fn("application.enforceMemberLimit")(function* (
  repository: RepositoryService,
  organizationId: OrganizationId,
) {
  const { limits, usage } = yield* loadOrganizationBilling(repository, organizationId);
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
) {
  const { limits, usage } = yield* loadOrganizationBilling(repository, organizationId);
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
