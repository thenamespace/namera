import type { BillingResourceUsage } from "@namera-ai/protocol/dto";

export function sessionCustodyLimits(resources: ReadonlyArray<BillingResourceUsage> | undefined) {
  return {
    local:
      resources?.some(
        ({ key, remainingAmount }) => key === "local-session-keys" && remainingAmount <= 0n,
      ) ?? false,
    managed:
      resources?.some(
        ({ key, remainingAmount }) => key === "oneclaw-session-keys" && remainingAmount <= 0n,
      ) ?? false,
  };
}
