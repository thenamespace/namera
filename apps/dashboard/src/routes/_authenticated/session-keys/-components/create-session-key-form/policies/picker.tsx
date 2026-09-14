// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import { Button, Input, ListBox, Select, Typography } from "@namera-ai/ui";
import { HugeiconsIcon } from "@namera-ai/ui/icons";

import {
  sessionPolicyCatalog,
  policyDescription,
  type Enforcement,
  type PolicyChoice,
} from "./catalog";

export function PolicyPicker({
  enforcement,
  onEnforcementChange,
  unavailable,
  onSelect,
}: {
  enforcement: Enforcement;
  onEnforcementChange: (value: Enforcement) => void;
  unavailable: (choice: PolicyChoice) => boolean;
  onSelect: (choice: PolicyChoice) => void;
}) {
  const [search, setSearch] = useState("");
  const choices = sessionPolicyCatalog.filter(
    (entry) =>
      (enforcement === "onchain" ? entry.onchain : entry.api) &&
      `${entry.name} ${entry.description}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="min-w-0 flex-1"
          aria-label="Search policies"
          placeholder="Search policies…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          variant="secondary"
        />
        <Select
          aria-label="Enforcement"
          variant="secondary"
          className="w-36 shrink-0"
          selectedKey={enforcement}
          onSelectionChange={(value) => {
            if (value === "onchain" || value === "offchain") onEnforcementChange(value);
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="onchain" textValue="Onchain">
                Onchain
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="offchain" textValue="Offchain">
                Offchain
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
      <div className="grid max-h-[45vh] gap-2 overflow-y-auto p-0.5">
        {choices.map((entry) => {
          const disabled = unavailable(entry);
          return (
            <Button
              key={entry.id}
              type="button"
              variant="ghost"
              className="border-separator h-20 w-full justify-start gap-3 rounded-lg border px-3 py-3 text-left whitespace-normal"
              isDisabled={disabled}
              aria-label={`${disabled ? "Already configured or incompatible:" : "Configure"} ${entry.name}`}
              onPress={() => onSelect(entry)}
            >
              <span className="bg-default text-muted grid size-9 shrink-0 place-items-center rounded-lg">
                <HugeiconsIcon icon={entry.icon} size={18} />
              </span>
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="truncate text-sm font-medium">{entry.name}</span>
                <span className="text-muted line-clamp-2 text-xs leading-4 font-normal">
                  {policyDescription(entry, enforcement)}
                </span>
              </span>
              {disabled ? <span className="text-muted shrink-0 text-xs">Unavailable</span> : null}
            </Button>
          );
        })}
        {!choices.length ? (
          <div className="grid justify-items-center gap-2 py-10">
            <Typography.Paragraph>No matching policies</Typography.Paragraph>
            <Button type="button" variant="tertiary" size="sm" onPress={() => setSearch("")}>
              Clear search
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
