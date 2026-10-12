// oxlint-disable react-perf/jsx-no-jsx-as-prop -- The shared card exposes a ReactNode logo slot.
import type { EvmSessionKeyPolicy } from "@namera-ai/protocol/model";
import { HugeiconsIcon } from "@namera-ai/ui/icons";

import { evmPolicyDefinitions } from "./data";
import { SessionPolicyCard } from "./session-policy-card";
import { EvmPolicySummary } from "./summary";

type EvmPolicyDisplayCardProps = {
  policy: EvmSessionKeyPolicy;
};

export function EvmPolicyDisplayCard({ policy }: EvmPolicyDisplayCardProps) {
  const definition = evmPolicyDefinitions[policy.type];

  return (
    <SessionPolicyCard name={definition.name} logo={<HugeiconsIcon icon={definition.icon} />}>
      <EvmPolicySummary policy={policy} />
    </SessionPolicyCard>
  );
}

export type { EvmPolicyDisplayCardProps };
