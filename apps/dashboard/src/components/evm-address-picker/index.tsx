// oxlint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop
import { useState } from "react";

import { Button, Command, Popover, Skeleton } from "@namera-ai/ui";
import { Add01Icon, ArrowDown01Icon, HugeiconsIcon, Search01Icon } from "@namera-ai/ui/icons";
import { useDebounceValue } from "usehooks-ts";

import { useCatalogPickerSearch } from "@/hooks/catalog";

import { CustomAddress } from "./custom-address";
import { AddressIdentity } from "./identity";
import type { EvmAddressPickerProps, EvmAddressSelection } from "./types";

export type { EvmAddressPickerProps, EvmAddressSelection } from "./types";

const keepServerResults = () => true;

export function EvmAddressPicker({
  chainIds,
  types,
  value,
  onChange,
  label = "Select address",
  id,
  isDisabled = false,
  isInvalid = false,
  onBlur,
  "aria-describedby": describedBy,
}: EvmAddressPickerProps) {
  const [open, setOpen] = useState(false);
  const disabled = isDisabled || chainIds.length === 0 || types.length === 0;
  const eligible =
    value &&
    chainIds.includes(value.chainId) &&
    (value.source === "custom" || types.includes(value.match.catalog.data.type));
  const select = (selection: EvmAddressSelection) => {
    onChange(selection);
    setOpen(false);
    onBlur?.();
  };
  return (
    <Popover
      isOpen={open && !disabled}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur?.();
      }}
    >
      <Button
        {...(id ? { id } : {})}
        aria-label={label}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
        aria-invalid={isInvalid || (Boolean(value) && !eligible)}
        isDisabled={disabled}
        variant="secondary"
        className="h-[calc(2.5rem+2*var(--border-width-field))] min-h-9 w-full transform-none! justify-between rounded-lg px-3 py-0 sm:h-[calc(2.25rem+2*var(--border-width-field))]"
      >
        {eligible ? (
          <AddressIdentity value={value} compact />
        ) : (
          <span className="text-muted flex items-center gap-2">
            <HugeiconsIcon icon={Search01Icon} className="size-4" />
            {value ? "Select an address for these filters" : label}
          </span>
        )}
        <HugeiconsIcon icon={ArrowDown01Icon} className="text-muted size-4 shrink-0" />
      </Button>
      <Popover.Content
        placement="bottom start"
        className="w-(--trigger-width) max-w-[calc(100vw-2rem)] overflow-hidden rounded-b-lg p-0"
      >
        {open && !disabled ? (
          <PickerContent
            key={JSON.stringify([chainIds, types])}
            chainIds={chainIds}
            types={types}
            onSelect={select}
          />
        ) : null}
      </Popover.Content>
    </Popover>
  );
}

function PickerContent({
  chainIds,
  types,
  onSelect,
}: Pick<EvmAddressPickerProps, "chainIds" | "types"> & {
  onSelect: (value: EvmAddressSelection) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced] = useDebounceValue(query.trim(), 250);
  const [custom, setCustom] = useState(false);
  if (custom)
    return (
      <Popover.Dialog aria-label="Custom address" className="outline-none">
        <CustomAddress
          chainIds={chainIds}
          initialAddress={query.trim()}
          onSelect={onSelect}
          onBack={() => setCustom(false)}
        />
      </Popover.Dialog>
    );
  return (
    <Command>
      <Command.Dialog
        className="max-w-none rounded-b-lg"
        aria-label="Find an EVM address"
        inputValue={query}
        onInputChange={setQuery}
        filter={keepServerResults}
      >
        <Command.Header className="shrink-0">
          <Command.InputGroup aria-label="Search tokens, contracts, or addresses">
            <Command.InputGroup.Prefix>
              <HugeiconsIcon icon={Search01Icon} className="size-4" />
            </Command.InputGroup.Prefix>
            <Command.InputGroup.Input
              maxLength={200}
              placeholder="Search name, symbol, or address…"
            />
          </Command.InputGroup>
        </Command.Header>
        <SearchResults
          key={debounced}
          query={debounced}
          chainIds={chainIds}
          types={types}
          pending={query.trim() !== debounced}
          onSelect={onSelect}
        />
        <Command.Footer className="border-separator shrink-0 border-t bg-transparent p-2">
          <Button
            variant="tertiary"
            className="w-full justify-start rounded-md"
            onPress={() => setCustom(true)}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            Custom address
          </Button>
        </Command.Footer>
      </Command.Dialog>
    </Command>
  );
}

function SearchResults({
  query,
  chainIds,
  types,
  pending,
  onSelect,
}: Pick<EvmAddressPickerProps, "chainIds" | "types"> & {
  query: string;
  pending: boolean;
  onSelect: (value: EvmAddressSelection) => void;
}) {
  const [offset, setOffset] = useState(0);
  const search = useCatalogPickerSearch({ chainIds, types, query, offset });
  const loading = pending || search.isPending;
  const matches = loading || search.isError ? [] : (search.data?.matches ?? []);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <output
        className={
          loading || matches.length ? "sr-only" : "text-muted block shrink-0 px-3 pt-2 text-xs"
        }
        aria-live="polite"
      >
        {loading
          ? "Searching catalog…"
          : search.isError
            ? "Couldn’t load the catalog."
            : matches.length
              ? `${matches.length} addresses found.`
              : "No matching addresses. Try another search or add a custom address."}
      </output>
      {loading ? (
        <div aria-hidden="true" className="overflow-hidden p-1.5">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex h-9 items-center gap-3 rounded-lg px-3 py-2">
              <Skeleton className="size-5 shrink-0 rounded-full motion-reduce:animate-none" />
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <Skeleton className="h-3.5 w-14 rounded motion-reduce:animate-none" />
                <Skeleton className="h-3 w-20 rounded motion-reduce:animate-none" />
              </span>
              <Skeleton className="ml-auto h-3 w-24 rounded motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      ) : null}
      {search.isError ? (
        <Button className="m-2" size="sm" variant="tertiary" onPress={search.refetch}>
          Retry
        </Button>
      ) : null}
      <Command.List
        aria-label="Address suggestions"
        className={loading ? "hidden" : "min-h-0 max-h-72 overflow-y-auto"}
      >
        {matches.map((match) => {
          const selection: EvmAddressSelection = {
            source: "catalog",
            namespace: "eip155",
            chainId: match.entry.chainId,
            address: match.entry.address,
            match,
          };
          return (
            <Command.Item
              key={match.entry.id}
              id={match.entry.id}
              textValue={`${match.catalog.data.display.name} ${match.entry.chainId} ${match.entry.address}`}
              className="px-3 py-2"
              onAction={() => onSelect(selection)}
            >
              <AddressIdentity value={selection} compact />
            </Command.Item>
          );
        })}
      </Command.List>
      {offset > 0 || search.data?.hasMore ? (
        <div className="flex shrink-0 justify-between px-2 pb-2">
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={offset === 0 || loading}
            onPress={() => setOffset(offset - 20)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={!search.data?.hasMore || loading || offset >= 10000}
            onPress={() => setOffset(offset + 20)}
          >
            More results
          </Button>
        </div>
      ) : null}
    </div>
  );
}
