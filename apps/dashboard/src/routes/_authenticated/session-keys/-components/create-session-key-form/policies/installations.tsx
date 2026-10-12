// oxlint-disable react-perf/jsx-no-new-function-as-prop react-perf/jsx-no-new-array-as-prop
import { useState, type ComponentProps } from "react";

import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Field, FieldLabel } from "@namera-ai/ui";
import { useWatch } from "react-hook-form";

import { EvmChainSelect } from "@/components/evm-chain-select";
import { HeadingGroup } from "@/components/heading-group";
import type { TokenSpendingSelection } from "@/components/policy/evm/onchain/token-allowance/form";

import { PolicySection } from "./index";

type Props = Omit<
  ComponentProps<typeof PolicySection>,
  "installationIndex" | "onSaveTokenSelection"
> & {
  onSaveTokenSelection: (chainId: SupportedEvmChainId, selection: TokenSpendingSelection) => void;
};

export function InstallationPolicies({ form, onSaveTokenSelection, ...props }: Props) {
  const installations = useWatch({ control: form.control, name: "onchain.installations" });
  const [selectedChain, setSelectedChain] = useState<SupportedEvmChainId>();
  const activeChain =
    installations.find(({ chainId }) => chainId === selectedChain)?.chainId ??
    installations[0]?.chainId ??
    null;

  return (
    <section className="grid gap-6">
      <HeadingGroup>
        <HeadingGroup.Title size="sm">Policies</HeadingGroup.Title>
        <HeadingGroup.Description>
          Configure access and limits for each selected network.
        </HeadingGroup.Description>
      </HeadingGroup>
      <Field>
        <FieldLabel id="policy-network-label">Edit policies for</FieldLabel>
        <EvmChainSelect
          aria-labelledby="policy-network-label"
          chainIds={installations.map(({ chainId }) => chainId)}
          value={activeChain}
          onChange={setSelectedChain}
          isDisabled={props.editing}
        />
      </Field>
      {installations.map((installation, index) => (
        <div key={installation.chainId} hidden={installation.chainId !== activeChain}>
          <PolicySection
            {...props}
            form={form}
            installationIndex={index}
            onSaveTokenSelection={(selection) =>
              onSaveTokenSelection(installation.chainId, selection)
            }
          />
        </div>
      ))}
    </section>
  );
}
