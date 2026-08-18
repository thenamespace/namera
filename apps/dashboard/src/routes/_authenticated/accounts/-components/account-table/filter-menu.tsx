import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Button, Checkbox, Dropdown, Label, type DataGridSelection } from "@namera-ai/ui";
import {
  Activity01Icon,
  CodeIcon,
  FilterHorizontalIcon,
  HugeiconsIcon,
  Shield01Icon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import {
  WalletImplementationDisplay,
  WalletProtectionDisplay,
  WalletStatusDisplay,
} from "@/components/display";

const statusOptions = ["active", "frozen", "archived"] as const;
const implementationOptions = ["kernel", "safe"] as const;
const protectionOptions = ["software", "hsm"] as const;

type AccountFilters = {
  status: ReadonlySet<WalletResponse["status"]>;
  implementation: ReadonlySet<WalletResponse["implementation"]>;
  protectionLevel: ReadonlySet<WalletResponse["protectionLevel"]>;
};

type AccountFilterCounts = {
  status: Record<WalletResponse["status"], number>;
  implementation: Record<WalletResponse["implementation"], number>;
  protectionLevel: Record<WalletResponse["protectionLevel"], number>;
};

type AccountFilterMenuProps = {
  counts: AccountFilterCounts;
  filters: AccountFilters;
  onChange: (filters: AccountFilters) => void;
};

function createEmptyAccountFilters(): AccountFilters {
  return {
    status: new Set(),
    implementation: new Set(),
    protectionLevel: new Set(),
  };
}

function selectionSummary(selection: ReadonlySet<string>, labels: Record<string, string>): string {
  if (selection.size === 0) return "Any";
  if (selection.size === 1) {
    const value = selection.values().next().value;
    return value === undefined ? "Any" : (labels[value] ?? value);
  }
  return `${selection.size} selected`;
}

function toSelection<T extends string>(keys: DataGridSelection, options: ReadonlyArray<T>): Set<T> {
  if (keys === "all") return new Set(options);
  return new Set([...keys].filter((key): key is T => typeof key === "string"));
}

const statusLabels: Record<WalletResponse["status"], string> = {
  active: "Active",
  archived: "Archived",
  frozen: "Frozen",
};

const implementationLabels: Record<WalletResponse["implementation"], string> = {
  kernel: "Kernel",
  safe: "Safe",
};

const protectionLabels: Record<WalletResponse["protectionLevel"], string> = {
  hsm: "HSM",
  software: "Software",
};

type FilterCheckboxProps = {
  isSelected: boolean;
  label: string;
};

function FilterCheckbox({ isSelected, label }: FilterCheckboxProps) {
  return (
    <Checkbox
      isReadOnly
      aria-label={label}
      className="pointer-events-none shrink-0 [&_input]:hidden"
      isSelected={isSelected}
    >
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

export function AccountFilterMenu({ counts, filters, onChange }: AccountFilterMenuProps) {
  const activeFilterCount =
    filters.status.size + filters.implementation.size + filters.protectionLevel.size;

  const handleStatusChange = useEventCallback((keys: DataGridSelection) => {
    onChange({ ...filters, status: toSelection(keys, statusOptions) });
  });
  const handleImplementationChange = useEventCallback((keys: DataGridSelection) => {
    onChange({ ...filters, implementation: toSelection(keys, implementationOptions) });
  });
  const handleProtectionChange = useEventCallback((keys: DataGridSelection) => {
    onChange({ ...filters, protectionLevel: toSelection(keys, protectionOptions) });
  });
  const handleRootAction = useEventCallback((key: string | number) => {
    if (key === "clear") onChange(createEmptyAccountFilters());
  });

  return (
    <Dropdown>
      <Button
        isIconOnly
        aria-label="Apply account filters"
        className="relative rounded-full"
        size="sm"
        variant="tertiary"
      >
        <HugeiconsIcon icon={FilterHorizontalIcon} />
        {activeFilterCount > 0 ? (
          <span className="bg-accent text-accent-foreground absolute -right-1 -top-1 grid size-4 place-items-center rounded-full text-[10px] font-medium">
            {activeFilterCount}
          </span>
        ) : null}
      </Button>

      <Dropdown.Popover className="min-w-72" placement="bottom end">
        <Dropdown.Menu onAction={handleRootAction}>
          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="status" textValue="Status">
              <HugeiconsIcon className="size-4 text-muted" icon={Activity01Icon} />
              <Label>Status</Label>
              <span className="ml-auto max-w-24 truncate text-xs text-muted">
                {selectionSummary(filters.status, statusLabels)}
              </span>
              <Dropdown.SubmenuIndicator />
            </Dropdown.Item>
            <Dropdown.Popover className="min-w-64">
              <Dropdown.Menu
                selectedKeys={filters.status}
                selectionMode="multiple"
                onSelectionChange={handleStatusChange}
              >
                {statusOptions.map((value) => (
                  <Dropdown.Item id={value} key={value} textValue={statusLabels[value]}>
                    <FilterCheckbox
                      isSelected={filters.status.has(value)}
                      label={`Filter by ${statusLabels[value]} status`}
                    />
                    <WalletStatusDisplay status={value} />
                    <span className="ml-auto text-xs tabular-nums text-muted">
                      {counts.status[value]}
                    </span>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.SubmenuTrigger>

          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="implementation" textValue="Implementation">
              <HugeiconsIcon className="size-4 text-muted" icon={CodeIcon} />
              <Label>Implementation</Label>
              <span className="ml-auto max-w-24 truncate text-xs text-muted">
                {selectionSummary(filters.implementation, implementationLabels)}
              </span>
              <Dropdown.SubmenuIndicator />
            </Dropdown.Item>
            <Dropdown.Popover className="min-w-64">
              <Dropdown.Menu
                selectedKeys={filters.implementation}
                selectionMode="multiple"
                onSelectionChange={handleImplementationChange}
              >
                {implementationOptions.map((value) => (
                  <Dropdown.Item id={value} key={value} textValue={implementationLabels[value]}>
                    <FilterCheckbox
                      isSelected={filters.implementation.has(value)}
                      label={`Filter by ${implementationLabels[value]} implementation`}
                    />
                    <WalletImplementationDisplay implementation={value} />
                    <span className="ml-auto text-xs tabular-nums text-muted">
                      {counts.implementation[value]}
                    </span>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.SubmenuTrigger>

          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="protection" textValue="Protection">
              <HugeiconsIcon className="size-4 text-muted" icon={Shield01Icon} />
              <Label>Protection</Label>
              <span className="ml-auto max-w-24 truncate text-xs text-muted">
                {selectionSummary(filters.protectionLevel, protectionLabels)}
              </span>
              <Dropdown.SubmenuIndicator />
            </Dropdown.Item>
            <Dropdown.Popover className="min-w-64">
              <Dropdown.Menu
                selectedKeys={filters.protectionLevel}
                selectionMode="multiple"
                onSelectionChange={handleProtectionChange}
              >
                {protectionOptions.map((value) => (
                  <Dropdown.Item id={value} key={value} textValue={protectionLabels[value]}>
                    <FilterCheckbox
                      isSelected={filters.protectionLevel.has(value)}
                      label={`Filter by ${protectionLabels[value]} protection`}
                    />
                    <WalletProtectionDisplay protectionLevel={value} />
                    <span className="ml-auto text-xs tabular-nums text-muted">
                      {counts.protectionLevel[value]}
                    </span>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.SubmenuTrigger>

          <Dropdown.Item id="clear" isDisabled={activeFilterCount === 0} textValue="Clear filters">
            <Label>Clear filters</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export type { AccountFilterCounts, AccountFilterMenuProps, AccountFilters };
export { createEmptyAccountFilters };
