// oxlint-disable react-perf/jsx-no-new-function-as-prop react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-jsx-as-prop
import { useEffect, useRef, useState, type ComponentProps } from "react";

import { getChainDataByCaip2 } from "@namera-ai/evm/chains";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Field, FieldError, FieldLabel } from "@namera-ai/ui";
import { useWatch } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { EvmChainSelect } from "@/components/evm-chain-select";
import { HeadingGroup } from "@/components/heading-group";
import type { TokenSpendingSelection } from "@/components/policy/evm/onchain/token-allowance/form";

import { PolicySection } from "./index";

type Props = Omit<
  ComponentProps<typeof PolicySection>,
  "installationIndex" | "onSaveTokenSelection" | "networkSelector"
> & {
  onSaveTokenSelection: (chainId: SupportedEvmChainId, selection: TokenSpendingSelection) => void;
};

export function InstallationPolicies({ form, onSaveTokenSelection, ...props }: Props) {
  const installations = useWatch({ control: form.control, name: "onchain.installations" });
  const [selectedChain, setSelectedChain] = useState<SupportedEvmChainId>();
  const activePanel = useRef<HTMLFieldSetElement>(null);
  const focusAfterSwitch = useRef(false);
  const { errors, submitCount, isSubmitted } = form.formState;
  const activeChain =
    installations.find(({ chainId }) => chainId === selectedChain)?.chainId ??
    installations[0]?.chainId ??
    null;
  const revealInvalidNetwork = useEventCallback(() => {
    if (!Object.keys(errors).length) return;
    const invalid = installations.find((_, index) => errors.onchain?.installations?.[index]);
    if (invalid && invalid.chainId !== activeChain) {
      focusAfterSwitch.current = true;
      setSelectedChain(invalid.chainId);
    } else activePanel.current?.focus();
  });

  useEffect(() => {
    if (submitCount > 0) revealInvalidNetwork();
  }, [submitCount, revealInvalidNetwork]);
  useEffect(() => {
    if (!activeChain || !focusAfterSwitch.current) return;
    focusAfterSwitch.current = false;
    activePanel.current?.focus();
  }, [activeChain]);

  return (
    <section className="grid gap-6">
      <HeadingGroup>
        <HeadingGroup.Title size="sm">Policies</HeadingGroup.Title>
        <HeadingGroup.Description>
          Configure access and limits for each selected network.
        </HeadingGroup.Description>
      </HeadingGroup>
      {isSubmitted ? (
        <FieldError
          errors={[
            errors.onchain?.installations,
            errors.onchain?.installations?.root,
            errors.onchain,
            errors.policies,
          ]}
        />
      ) : null}
      {installations.map((installation, index) => (
        <fieldset
          key={installation.chainId}
          hidden={installation.chainId !== activeChain}
          ref={installation.chainId === activeChain ? activePanel : undefined}
          aria-label={`${getChainDataByCaip2(installation.chainId)?.chain.name ?? installation.chainId} policies`}
          tabIndex={-1}
          className="m-0 min-w-0 rounded-lg border-0 p-0 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <PolicySection
            {...props}
            form={form}
            installationIndex={index}
            networkSelector={
              <Field>
                <FieldLabel id={`policy-network-${installation.chainId}`}>
                  Edit policies for
                </FieldLabel>
                <EvmChainSelect
                  aria-labelledby={`policy-network-${installation.chainId}`}
                  chainIds={installations.map(({ chainId }) => chainId)}
                  value={activeChain}
                  onChange={setSelectedChain}
                  isDisabled={props.editing}
                />
              </Field>
            }
            onSaveTokenSelection={(selection) =>
              onSaveTokenSelection(installation.chainId, selection)
            }
          />
        </fieldset>
      ))}
    </section>
  );
}
