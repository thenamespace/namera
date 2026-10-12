// oxlint-disable react-perf/jsx-no-new-function-as-prop
import type { ComponentProps } from "react";

import { chains } from "@namera-ai/evm/chains";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Collection, Header, ListBox, Select } from "@namera-ai/ui";
import { ChainIcon } from "@namera-ai/ui/icons";

type EvmChainSelectProps = {
  chainIds: readonly SupportedEvmChainId[];
  value: SupportedEvmChainId | null;
  onChange: (chainId: SupportedEvmChainId) => void;
  "aria-labelledby": string;
  "aria-describedby"?: string;
  name?: string;
  isInvalid?: boolean;
  isDisabled?: boolean;
  variant?: ComponentProps<typeof Select>["variant"];
  onBlur?: ComponentProps<typeof Select.Trigger>["onBlur"];
  triggerRef?: ComponentProps<typeof Select.Trigger>["ref"];
};

export function EvmChainSelect({
  chainIds,
  value,
  onChange,
  onBlur,
  triggerRef,
  variant = "secondary",
  isDisabled = false,
  ...props
}: EvmChainSelectProps) {
  const networks = Object.values(chains).filter((network) => chainIds.includes(network.chainId));
  const selected = networks.find((network) => network.chainId === value);
  const groups = [
    {
      id: "mainnets",
      label: "Mainnets",
      networks: networks.filter((network) => !network.chain.testnet),
    },
    {
      id: "testnets",
      label: "Testnets",
      networks: networks.filter((network) => network.chain.testnet),
    },
  ].filter((group) => group.networks.length > 0);

  return (
    <Select
      {...props}
      fullWidth
      variant={variant}
      isDisabled={isDisabled || networks.length === 0}
      value={selected?.chainId ?? null}
      onChange={(key) => {
        const selectedNetwork = networks.find((network) => network.chainId === key);
        if (selectedNetwork) onChange(selectedNetwork.chainId);
      }}
    >
      <Select.Trigger ref={triggerRef} {...(onBlur ? { onBlur } : {})}>
        <Select.Value>
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <ChainIcon
                aria-hidden
                namespace="eip155"
                chain={selected.name}
                className="size-4 shrink-0"
              />
              <span className="truncate">{selected.chain.name}</span>
            </span>
          ) : (
            "Select network"
          )}
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="w-(--trigger-width)">
        <ListBox className="max-h-60 overflow-y-auto">
          {groups.map((group) => (
            <ListBox.Section id={group.id} key={group.id}>
              <Header className="text-muted px-2 py-2 text-xs font-medium">{group.label}</Header>
              <Collection items={group.networks}>
                {(network) => (
                  <ListBox.Item id={network.chainId} textValue={network.chain.name}>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <ChainIcon
                        aria-hidden
                        namespace="eip155"
                        chain={network.name}
                        className="size-4 shrink-0"
                      />
                      <span className="truncate">{network.chain.name}</span>
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                )}
              </Collection>
            </ListBox.Section>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
