// oxlint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop
import { useState } from "react";

import { Button, ComboBox, Input, ListBox, Modal, Skeleton } from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon, Search01Icon } from "@namera-ai/ui/icons";
import { useDebounceValue } from "usehooks-ts";

import { chainDataById } from "@/components/display/chain-display";
import { useCatalogPickerSearch } from "@/hooks/catalog";

import { CustomAddress } from "./custom-address";
import { AddressIdentity } from "./identity";
import type { EvmAddressPickerProps, EvmAddressSelection } from "./types";

export type { EvmAddressPickerProps, EvmAddressSelection } from "./types";

const keepServerResults = () => true;
const noChains = [] as const;

function selectionText(value: EvmAddressSelection | null) {
  if (!value) return "";
  const name =
    value.source === "catalog" ? value.match.catalog.data.display.name : "Custom address";
  const network = chainDataById.get(value.chainId)?.chain.name ?? value.chainId;
  return `${name} · ${network} · ${value.address.slice(0, 6)}…${value.address.slice(-4)}`;
}

export function EvmAddressPicker(props: EvmAddressPickerProps) {
  return <AddressComboBox key={JSON.stringify([props.chainIds, props.types])} {...props} />;
}

function AddressComboBox({
  chainIds,
  types,
  value,
  onChange,
  label = "EVM address",
  placeholder = "Search name, symbol, or address…",
  id,
  isDisabled = false,
  isInvalid = false,
  onBlur,
  "aria-describedby": describedBy,
}: EvmAddressPickerProps) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [customSeed, setCustomSeed] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const disabled = isDisabled || chainIds.length === 0 || types.length === 0;
  const eligible =
    value &&
    chainIds.includes(value.chainId) &&
    (value.source === "custom" || types.includes(value.match.catalog.data.type));
  const selected = eligible ? value : null;
  const query = draft?.trim() ?? "";
  const [debounced] = useDebounceValue(query, 250);
  const search = useCatalogPickerSearch({
    chainIds: open && !disabled && !custom ? chainIds : noChains,
    types,
    query: debounced,
    offset,
  });
  const loading = query !== debounced || search.isPending;
  const matches = loading || search.isError ? [] : (search.data?.matches ?? []);
  const selections: EvmAddressSelection[] = matches.map((match) => ({
    source: "catalog",
    namespace: "eip155",
    chainId: match.entry.chainId,
    address: match.entry.address,
    match,
  }));
  const select = (selection: EvmAddressSelection) => {
    onChange(selection);
    setDraft(null);
    setCustom(false);
    onBlur?.();
  };

  return (
    <>
      <ComboBox
        aria-label={label}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
        fullWidth
        allowsEmptyCollection
        allowsCustomValue
        defaultFilter={keepServerResults}
        isDisabled={disabled}
        isInvalid={isInvalid || (Boolean(value) && !eligible)}
        inputValue={draft ?? selectionText(selected)}
        value={selected?.source === "catalog" ? selected.match.entry.id : null}
        onInputChange={(text) => {
          setDraft(text);
          setOffset(0);
          if (value) onChange(null);
        }}
        onOpenChange={setOpen}
        onBlur={() => {
          setDraft(null);
          onBlur?.();
        }}
        onChange={(key) => {
          if (key === "custom") {
            setCustomSeed(query);
            setCustom(true);
            return;
          }
          const selection = selections.find(
            (option) => option.source === "catalog" && option.match.entry.id === key,
          );
          if (selection) select(selection);
        }}
      >
        <ComboBox.InputGroup>
          <HugeiconsIcon
            aria-hidden
            icon={Search01Icon}
            className="text-muted pointer-events-none absolute left-3 z-10 size-4"
          />
          <Input
            {...(id ? { id } : {})}
            placeholder={placeholder}
            maxLength={200}
            className="pl-9"
          />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <ComboBox.Popover className="w-(--trigger-width) max-w-[calc(100vw-2rem)] rounded-xl p-1">
          {loading ? (
            <div aria-hidden className="grid gap-3 p-3">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-full motion-reduce:animate-none" />
                  <div className="grid flex-1 gap-2">
                    <Skeleton className="h-3 w-1/3 rounded motion-reduce:animate-none" />
                    <Skeleton className="h-2.5 w-2/3 rounded motion-reduce:animate-none" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <output
            aria-live="polite"
            className={loading || matches.length ? "sr-only" : "text-muted block px-3 py-3 text-xs"}
          >
            {loading
              ? "Searching addresses"
              : search.isError
                ? "Couldn’t load addresses. Try again."
                : matches.length
                  ? `${matches.length} addresses found`
                  : "No matching addresses. Try another search or add a custom address."}
          </output>
          {search.isError ? (
            <Button size="sm" variant="tertiary" onPress={search.refetch}>
              Retry
            </Button>
          ) : null}
          <ListBox aria-label="Address suggestions" className="max-h-72 overflow-y-auto">
            {selections.map((selection) =>
              selection.source === "catalog" ? (
                <ListBox.Item
                  key={selection.match.entry.id}
                  id={selection.match.entry.id}
                  textValue={selectionText(selection)}
                  className="px-3 py-2.5"
                >
                  <AddressIdentity value={selection} />
                </ListBox.Item>
              ) : null,
            )}
            <ListBox.Item
              id="custom"
              textValue="Custom address"
              className="border-separator mt-1 border-t px-3 py-3"
            >
              <HugeiconsIcon icon={Add01Icon} className="size-4" />
              Custom address
            </ListBox.Item>
          </ListBox>
          {offset > 0 || search.data?.hasMore ? (
            <div className="flex justify-between p-1">
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
        </ComboBox.Popover>
      </ComboBox>
      <Modal isOpen={custom && !disabled} onOpenChange={setCustom}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog aria-label="Custom address" className="sm:max-w-md">
              <CustomAddress
                chainIds={chainIds}
                initialAddress={customSeed}
                onSelect={select}
                onBack={() => setCustom(false)}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
