import { DateTime, Effect } from "effect";

import type { RepositoryService } from "@namera-ai/database";
import { BillingLimitExceededError, type OrganizationId } from "@namera-ai/protocol";
import type {
  BillingPlanLimits,
  BillingSubscription,
  WalletKeyProtectionLevel,
} from "@namera-ai/protocol/model";

import { billingPlans } from "./data.js";

export const resolveBillingPlan = (subscription: BillingSubscription) => {
  const plan = billingPlans[subscription.plan];
  if (plan.version !== subscription.planVersion) {
    throw new Error(
      `Unsupported billing plan version: ${subscription.plan}@${subscription.planVersion}`,
    );
  }
  return plan;
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
  return { subscription, limits: plan.limits, usage };
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

export const enforceExecutionLimit = Effect.fn("application.enforceExecutionLimit")(function* (
  repository: RepositoryService,
  organizationId: OrganizationId,
) {
  const { limits, usage } = yield* loadOrganizationBilling(repository, organizationId);
  if (usage.executions >= limits.includedExecutions) {
    return yield* new BillingLimitExceededError({
      code: "LIMIT_EXCEEDED",
      limit: "executions",
    });
  }
});

export const enforceSignatureLimit = Effect.fn("application.enforceSignatureLimit")(function* (
  repository: RepositoryService,
  organizationId: OrganizationId,
) {
  const { limits, usage } = yield* loadOrganizationBilling(repository, organizationId);
  if (usage.signatures >= limits.includedSignatures) {
    return yield* new BillingLimitExceededError({
      code: "LIMIT_EXCEEDED",
      limit: "signatures",
    });
  }
});

export type BillingLimits = BillingPlanLimits;
