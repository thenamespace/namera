import { DateTime } from "effect";

import type { ListWalletsResponse } from "@namera-ai/protocol/dto";
import type { RegisteredTemplate } from "@namera-ai/templates";

import { supportsSessionKeys } from "@/lib/session-owner";

import type { CreateSessionKeyFormInput } from "./types";

export type SessionKeyInitialOptions = {
  initialAccountId?: string | undefined;
  template?: RegisteredTemplate | undefined;
  onboarding?: boolean | undefined;
};

export function createSessionKeyInitialValues(
  wallets: ListWalletsResponse,
  { initialAccountId, template, onboarding = false }: SessionKeyInitialOptions,
  nowSeconds: number,
): CreateSessionKeyFormInput {
  const useOnboardingPreset = onboarding && !template;
  const account = useOnboardingPreset
    ? wallets
        .filter(supportsSessionKeys)
        .toSorted(
          (left, right) =>
            DateTime.toEpochMillis(right.createdAt) - DateTime.toEpochMillis(left.createdAt) ||
            right.id.localeCompare(left.id),
        )[0]
    : wallets.find((wallet) => wallet.id === initialAccountId && supportsSessionKeys(wallet));

  return {
    custody: "namera-managed",
    namespace: "eip155",
    metadata: {
      version: 1,
      name: useOnboardingPreset ? "My first session key" : "",
      logo: { type: "emoji", value: "🔑" },
      description: "",
      ...template?.metadata,
    },
    walletId: account?.id ?? "",
    policies: useOnboardingPreset
      ? [{ type: "evm.signature", version: 1, allowedTypes: ["message"] }]
      : [],
    onchain: {
      installations: [
        {
          chainId: useOnboardingPreset ? "eip155:8453" : "eip155:1",
          validAfter: 0,
          validUntil: nowSeconds + 30 * 24 * 60 * 60,
          permissions: useOnboardingPreset ? [{ type: "root" }] : [],
          allowSignatures: useOnboardingPreset,
        },
      ],
    },
  };
}
