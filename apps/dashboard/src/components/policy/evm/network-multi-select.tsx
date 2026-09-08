import type { ComponentProps } from "react";

// oxlint-disable react-perf/jsx-no-new-function-as-prop
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Checkbox, ListBox, Select } from "@namera-ai/ui";
import { ChainIcon } from "@namera-ai/ui/icons";

import { evmChainById, evmChainOptions } from "./data";

type EvmNetworkMultiSelectProps = {
  "aria-labelledby": string;
  isInvalid?: boolean;
  operationalOnly?: boolean;
  name: string;
  onBlur: () => void;
  onChange: (chainIds: ReadonlyArray<SupportedEvmChainId>) => void;
  triggerRef: ComponentProps<typeof Select.Trigger>["ref"];
  value: ReadonlyArray<SupportedEvmChainId>;
};

export function EvmNetworkMultiSelect({
  "aria-labelledby": ariaLabelledBy,
  isInvalid = false,
  operationalOnly = false,
  name,
  onBlur,
  onChange,
  triggerRef,
  value,
}: EvmNetworkMultiSelectProps) {
  const selectedChains = value.flatMap((chainId) => {
    const chain = evmChainById.get(chainId);
    return chain ? [chain] : [];
  });
  const selectable = evmChainOptions.filter((chain) => !operationalOnly || chain.operationsEnabled);
  const allNetworksSelected =
    selectable.length > 0 && selectable.every((chain) => value.includes(chain.id));

  return (
    <Select<(typeof evmChainOptions)[number], "multiple">
      aria-labelledby={ariaLabelledBy}
      fullWidth
      isInvalid={isInvalid}
      name={name}
      selectionMode="multiple"
      value={Array.from(value)}
      variant="secondary"
      onChange={(keys) => onChange(keys.map((key) => String(key) as SupportedEvmChainId))}
    >
      <Select.Trigger onBlur={onBlur} ref={triggerRef}>
        <Select.Value>
          {selectedChains[0] ? (
            <span className="flex items-center gap-2">
              <ChainIcon
                aria-hidden
                chain={selectedChains[0].chain}
                className="size-4"
                namespace="eip155"
              />
              <span className="truncate">
                {selectedChains.length === 1
                  ? selectedChains[0].name
                  : `${selectedChains.length} networks`}
              </span>
            </span>
          ) : (
            "Select networks"
          )}
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="w-(--trigger-width) overflow-hidden p-1">
        <Checkbox
          aria-label="Select all networks"
          className="w-full rounded-md px-2 py-1.5 transition-colors hover:bg-default"
          isSelected={allNetworksSelected}
          isDisabled={selectable.length === 0}
          onChange={(isSelected) => onChange(isSelected ? selectable.map((chain) => chain.id) : [])}
        >
          <Checkbox.Content className="w-full">
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <span className="flex-1 text-left font-medium">Select all networks</span>
            <span className="text-muted text-xs">{selectable.length}</span>
          </Checkbox.Content>
        </Checkbox>
        <ListBox className="max-h-60 overflow-y-auto" items={evmChainOptions}>
          {(chain) => (
            <ListBox.Item
              id={chain.id}
              isDisabled={operationalOnly && !chain.operationsEnabled}
              textValue={`${chain.name} (${chain.nativeCurrency.symbol})`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <ChainIcon
                  aria-hidden
                  chain={chain.chain}
                  className="size-4 shrink-0"
                  namespace="eip155"
                />
                <span className="truncate">
                  {chain.name}{" "}
                  <span className="text-muted text-xs">({chain.nativeCurrency.symbol})</span>
                </span>
              </div>
              {!chain.operationsEnabled ? <span className="text-muted text-xs">Paused</span> : null}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
