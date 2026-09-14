import type { TimeWindowPolicyInput } from "@/components/policy/evm/types";

export function toTimeWindowPolicy(validAfter: number, validUntil: number): TimeWindowPolicyInput {
  return {
    type: "evm.time-window",
    version: 1,
    startsAt: validAfter ? new Date(validAfter * 1000).toISOString() : null,
    expiresAt: validUntil ? new Date(validUntil * 1000).toISOString() : "",
  };
}

export function toOnchainLifetime(policy: TimeWindowPolicyInput) {
  return {
    validAfter: policy.startsAt ? Math.floor(new Date(policy.startsAt).getTime() / 1000) : 0,
    validUntil: Math.floor(new Date(policy.expiresAt).getTime() / 1000),
  };
}

export const formatLifetimeDate = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString(undefined, { dateStyle: "medium" });
