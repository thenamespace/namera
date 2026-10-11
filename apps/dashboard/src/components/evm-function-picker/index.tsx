// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useMemo, useState, type ComponentProps } from "react";

import { Button, Command, Popover } from "@namera-ai/ui";
import { ArrowDown01Icon, Tick02Icon, HugeiconsIcon, Search01Icon } from "@namera-ai/ui/icons";
import type { Abi } from "viem";

import { abiFunctionOptions, filterFunctions, selectFunctions } from "./functions";

type CommonProps = {
  readonly abi: Abi;
  readonly label?: string;
  readonly id?: string;
  readonly isDisabled?: boolean;
  readonly isInvalid?: boolean;
  readonly "aria-describedby"?: string;
  readonly onBlur?: () => void;
  readonly triggerRef?: ComponentProps<typeof Button>["ref"];
};

export type EvmFunctionPickerProps = CommonProps &
  (
    | {
        readonly selectionMode: "single";
        readonly value: string | null;
        readonly onChange: (signature: string | null) => void;
      }
    | {
        readonly selectionMode: "multiple";
        readonly value: readonly string[];
        readonly onChange: (signatures: readonly string[]) => void;
      }
  );

const keepFilteredFunctions = () => true;

export function EvmFunctionPicker({
  triggerRef,
  abi,
  label = "Select functions",
  isDisabled = false,
  isInvalid = false,
  ...props
}: EvmFunctionPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const functions = useMemo(() => abiFunctionOptions(abi), [abi]);
  const filtered = useMemo(() => filterFunctions(functions, query), [functions, query]);
  const selected = new Set(
    props.selectionMode === "multiple" ? props.value : props.value ? [props.value] : [],
  );
  const selectedFunctions = functions.filter((fn) => selected.has(fn.signature));
  const invalidSelection = [...selected].some(
    (signature) => !functions.some((fn) => fn.signature === signature),
  );
  const summary =
    selectedFunctions.length === 1
      ? (selectedFunctions[0]?.signature ?? label)
      : selectedFunctions.length > 1
        ? `${selectedFunctions.length} functions selected`
        : label;

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      props.onBlur?.();
    }
  };
  const choose = (signature: string) => {
    if (props.selectionMode === "single") {
      props.onChange(signature);
      changeOpen(false);
      return;
    }
    props.onChange(
      selectFunctions(
        props.value.filter((current) => current !== signature),
        selected.has(signature) ? [] : [signature],
        functions,
      ),
    );
  };

  return (
    <Popover isOpen={open && !isDisabled} onOpenChange={changeOpen}>
      <Button
        {...(props.id ? { id: props.id } : {})}
        {...(props["aria-describedby"] ? { "aria-describedby": props["aria-describedby"] } : {})}
        ref={triggerRef}
        aria-label={label}
        aria-invalid={isInvalid || invalidSelection}
        isDisabled={isDisabled}
        variant="secondary"
        className="h-[calc(2.5rem+2*var(--border-width-field))] min-h-9 w-full transform-none! justify-between rounded-lg px-3 py-0 sm:h-[calc(2.25rem+2*var(--border-width-field))]"
      >
        <span className="min-w-0 truncate text-left" title={summary}>
          {summary}
        </span>
        <HugeiconsIcon icon={ArrowDown01Icon} className="text-muted size-4 shrink-0" />
      </Button>
      <Popover.Content
        placement="bottom start"
        className="w-(--trigger-width) max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg p-0"
      >
        <Command>
          <Command.Dialog
            aria-label={label}
            className="max-w-none rounded-lg"
            inputValue={query}
            onInputChange={setQuery}
            filter={keepFilteredFunctions}
          >
            <Command.Header className="shrink-0">
              <Command.InputGroup aria-label="Search functions">
                <Command.InputGroup.Prefix>
                  <HugeiconsIcon icon={Search01Icon} className="size-4" />
                </Command.InputGroup.Prefix>
                <Command.InputGroup.Input placeholder="Search name, signature, or selector…" />
              </Command.InputGroup>
            </Command.Header>
            <Command.List
              aria-label="ABI functions"
              className="min-h-0 overflow-y-auto"
              selectionMode={props.selectionMode}
              selectedKeys={selected}
              renderEmptyState={() =>
                functions.length ? "No matching functions." : "This ABI has no functions."
              }
            >
              {filtered.map((fn) => (
                <Command.Item
                  key={fn.signature}
                  id={fn.signature}
                  textValue={fn.signature}
                  onAction={() => choose(fn.signature)}
                  shouldCloseOnSelect={false}
                  className="gap-3 px-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs" title={fn.signature}>
                      {fn.signature}
                    </span>
                    <span className="text-muted mt-1 flex items-center gap-2 text-xs">
                      <span>{fn.abi.stateMutability}</span>
                      <span className="font-mono">{fn.selector}</span>
                    </span>
                  </span>
                  <span className="size-4 shrink-0" aria-hidden="true">
                    {selected.has(fn.signature) ? (
                      <HugeiconsIcon icon={Tick02Icon} className="text-accent size-4" />
                    ) : null}
                  </span>
                </Command.Item>
              ))}
            </Command.List>
            <Command.Footer className="flex shrink-0 flex-wrap justify-between gap-2 bg-transparent p-2">
              <output aria-live="polite" className="text-muted text-xs">
                {selectedFunctions.length} of {functions.length} selected
              </output>
              <div className="flex gap-1">
                {props.selectionMode === "multiple" ? (
                  <Button
                    size="sm"
                    variant="tertiary"
                    isDisabled={
                      !filtered.length || filtered.every((fn) => selected.has(fn.signature))
                    }
                    onPress={() =>
                      props.onChange(
                        selectFunctions(
                          props.value,
                          filtered.map((fn) => fn.signature),
                          functions,
                        ),
                      )
                    }
                  >
                    {query.trim() ? "Select results" : "Select all"}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="tertiary"
                  isDisabled={selected.size === 0}
                  onPress={() =>
                    props.selectionMode === "multiple" ? props.onChange([]) : props.onChange(null)
                  }
                >
                  {props.selectionMode === "multiple" ? "Deselect all" : "Clear"}
                </Button>
              </div>
            </Command.Footer>
          </Command.Dialog>
        </Command>
      </Popover.Content>
    </Popover>
  );
}
