// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useMemo, type ComponentProps } from "react";

import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { ListBox, Select } from "@namera-ai/ui";
import { ChainIcon } from "@namera-ai/ui/icons";

import { evmChainById, evmChainOptions } from "@/components/policy/evm/data";

export function TemplateNetworkSelect({
  chainIds,
  value,
  onChange,
  onBlur,
  triggerRef,
  ...props
}: {
  readonly chainIds: readonly SupportedEvmChainId[];
  readonly value: readonly SupportedEvmChainId[];
  readonly onChange: (value: readonly SupportedEvmChainId[]) => void;
  readonly onBlur: () => void;
  readonly triggerRef: ComponentProps<typeof Select.Trigger>["ref"];
  readonly name: string;
  readonly "aria-labelledby": string;
  readonly "aria-describedby": string;
  readonly isDisabled: boolean;
  readonly isInvalid: boolean;
}) {
  const selected = value[0] ? evmChainById.get(value[0]) : undefined;
  const options = useMemo(
    () => evmChainOptions.filter((chain) => chainIds.includes(chain.id)),
    [chainIds],
  );

  return (
    <Select
      {...props}
      fullWidth
      variant="secondary"
      value={selected?.id ?? null}
      onChange={(key) => onChange(key ? [String(key) as SupportedEvmChainId] : [])}
    >
      <Select.Trigger ref={triggerRef} onBlur={onBlur}>
        <Select.Value>
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <ChainIcon
                aria-hidden
                namespace="eip155"
                chain={selected.chain}
                className="size-4 shrink-0"
              />
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            "Select network"
          )}
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="w-(--trigger-width) overflow-hidden p-1">
        <ListBox items={options}>
          {(chain) => (
            <ListBox.Item
              id={chain.id}
              textValue={chain.name}
              isDisabled={!chain.operationsEnabled}
            >
              <ChainIcon
                aria-hidden
                namespace="eip155"
                chain={chain.chain}
                className="size-4 shrink-0"
              />
              <span className="flex-1 truncate">{chain.name}</span>
              {!chain.operationsEnabled ? <span className="text-xs text-muted">Paused</span> : null}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
