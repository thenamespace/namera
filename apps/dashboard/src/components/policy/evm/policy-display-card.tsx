import type { EvmSessionKeyPolicy } from "@namera-ai/protocol/model";
import { Chip, ItemCard } from "@namera-ai/ui";
import { HugeiconsIcon } from "@namera-ai/ui/icons";

import { evmPolicyDefinitions } from "./data";
import { EvmPolicySummary } from "./summary";

const applicabilityLabels = {
  both: "Executions and signatures",
  execution: "Executions",
  signature: "Signatures",
} as const;

type EvmPolicyDisplayCardProps = {
  policy: EvmSessionKeyPolicy;
};

export function EvmPolicyDisplayCard({ policy }: EvmPolicyDisplayCardProps) {
  const definition = evmPolicyDefinitions[policy.type];

  return (
    <ItemCard className="rounded-lg" variant="outline">
      <ItemCard.Icon className="self-start">
        <HugeiconsIcon icon={definition.icon} />
      </ItemCard.Icon>
      <ItemCard.Content>
        <div className="flex flex-wrap items-center gap-2">
          <ItemCard.Title>{definition.name}</ItemCard.Title>
          <Chip size="sm" variant="soft">
            <Chip.Label className="font-normal">{applicabilityLabels[policy.appliesTo]}</Chip.Label>
          </Chip>
        </div>
        <ItemCard.Description>
          <EvmPolicySummary policy={policy} />
        </ItemCard.Description>
      </ItemCard.Content>
    </ItemCard>
  );
}

export type { EvmPolicyDisplayCardProps };
