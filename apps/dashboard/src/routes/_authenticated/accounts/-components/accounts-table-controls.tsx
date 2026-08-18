import { useMemo } from "react";

import type { WalletResponse } from "@namera-ai/protocol/dto";
import {
  Button,
  Dropdown,
  Label,
  ListBox,
  Popover,
  Select,
  Separator,
  ToggleButton,
  Tooltip,
  Typography,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import {
  FilterHorizontalIcon,
  HugeiconsIcon,
  LayoutThreeColumnIcon,
  SortByDown01Icon,
  SortByUp01Icon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

const statusOptions = ["all", "active", "frozen", "archived"] as const;
const implementationOptions = ["all", "kernel", "safe"] as const;
const protectionOptions = ["all", "software", "hsm"] as const;

const groupingOptions = [
  { id: "none", label: "No grouping" },
  { id: "status", label: "Status" },
  { id: "implementation", label: "Implementation" },
  { id: "protectionLevel", label: "Protection" },
] as const;

type AccountGrouping = (typeof groupingOptions)[number]["id"];

type AccountFilters = {
  status: "all" | WalletResponse["status"];
  implementation: "all" | WalletResponse["implementation"];
  protectionLevel: "all" | WalletResponse["protectionLevel"];
};

type ColumnOption = {
  id: string;
  label: string;
};

type AccountsTableControlsProps = {
  columnOptions: ReadonlyArray<ColumnOption>;
  filters: AccountFilters;
  grouping: AccountGrouping;
  sort: DataGridSortDescriptor;
  sortableColumns: ReadonlyArray<ColumnOption>;
  visibleColumns: DataGridSelection;
  onFiltersChange: (filters: AccountFilters) => void;
  onGroupingChange: (grouping: AccountGrouping) => void;
  onResetView: () => void;
  onSortChange: (sort: DataGridSortDescriptor) => void;
  onVisibleColumnsChange: (columns: DataGridSelection) => void;
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function selection(value: string): Set<string> {
  return new Set([value]);
}

type ColumnToggleProps = {
  column: ColumnOption;
  isSelected: boolean;
  onChange: (id: string, selected: boolean) => void;
};

function ColumnToggle({ column, isSelected, onChange }: ColumnToggleProps) {
  const handleChange = useEventCallback((selected: boolean) => {
    onChange(column.id, selected);
  });

  return (
    <ToggleButton isSelected={isSelected} size="sm" onChange={handleChange}>
      {column.label}
    </ToggleButton>
  );
}

export function AccountsTableControls({
  columnOptions,
  filters,
  grouping,
  sort,
  sortableColumns,
  visibleColumns,
  onFiltersChange,
  onGroupingChange,
  onResetView,
  onSortChange,
  onVisibleColumnsChange,
}: AccountsTableControlsProps) {
  const activeFilterCount = Object.values(filters).filter((value) => value !== "all").length;
  const statusSelection = useMemo(() => selection(filters.status), [filters.status]);
  const implementationSelection = useMemo(
    () => selection(filters.implementation),
    [filters.implementation],
  );
  const protectionSelection = useMemo(
    () => selection(filters.protectionLevel),
    [filters.protectionLevel],
  );

  const updateFilter = useEventCallback((key: keyof AccountFilters, keys: DataGridSelection) => {
    if (keys === "all") return;
    const value = [...keys][0];
    if (typeof value !== "string") return;

    onFiltersChange({ ...filters, [key]: value });
  });
  const handleStatusSelectionChange = useEventCallback((keys: DataGridSelection) => {
    updateFilter("status", keys);
  });
  const handleImplementationSelectionChange = useEventCallback((keys: DataGridSelection) => {
    updateFilter("implementation", keys);
  });
  const handleProtectionSelectionChange = useEventCallback((keys: DataGridSelection) => {
    updateFilter("protectionLevel", keys);
  });
  const handleRootFilterAction = useEventCallback((key: string | number) => {
    if (key === "clear") {
      onFiltersChange({ status: "all", implementation: "all", protectionLevel: "all" });
    }
  });
  const handleGroupingChange = useEventCallback((key: string | number | null) => {
    if (typeof key === "string") onGroupingChange(key as AccountGrouping);
  });
  const handleSortColumnChange = useEventCallback((key: string | number | null) => {
    if (key !== null) onSortChange({ ...sort, column: key });
  });
  const handleSortDirectionChange = useEventCallback((ascending: boolean) => {
    onSortChange({ ...sort, direction: ascending ? "ascending" : "descending" });
  });
  const handleColumnToggle = useEventCallback((id: string, selected: boolean) => {
    const next =
      visibleColumns === "all"
        ? new Set(columnOptions.map((column) => column.id))
        : new Set(visibleColumns);
    if (selected) next.add(id);
    else next.delete(id);
    onVisibleColumnsChange(next);
  });

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip delay={300}>
        <Tooltip.Trigger className="inline-flex">
          <span className="inline-flex">
            <Dropdown>
              <Button
                isIconOnly
                aria-label="Apply account filters"
                className="relative rounded-full"
                size="sm"
                variant="secondary"
              >
                <HugeiconsIcon icon={FilterHorizontalIcon} />
                {activeFilterCount > 0 ? (
                  <span className="bg-accent text-accent-foreground absolute -right-1 -top-1 grid size-4 place-items-center rounded-full text-[10px] font-medium">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
              <Dropdown.Popover className="min-w-56" placement="bottom end">
                <Dropdown.Menu onAction={handleRootFilterAction}>
                  <Dropdown.SubmenuTrigger>
                    <Dropdown.Item id="status" textValue="Status">
                      <Label>Status</Label>
                      <span className="ml-auto text-xs capitalize text-muted">
                        {filters.status}
                      </span>
                      <Dropdown.SubmenuIndicator />
                    </Dropdown.Item>
                    <Dropdown.Popover className="min-w-44">
                      <Dropdown.Menu
                        selectedKeys={statusSelection}
                        selectionMode="single"
                        onSelectionChange={handleStatusSelectionChange}
                      >
                        {statusOptions.map((value) => (
                          <Dropdown.Item id={value} key={value} textValue={value}>
                            <Label>{value === "all" ? "Any status" : capitalize(value)}</Label>
                            <Dropdown.ItemIndicator />
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown.SubmenuTrigger>

                  <Dropdown.SubmenuTrigger>
                    <Dropdown.Item id="implementation" textValue="Implementation">
                      <Label>Implementation</Label>
                      <span className="ml-auto text-xs capitalize text-muted">
                        {filters.implementation}
                      </span>
                      <Dropdown.SubmenuIndicator />
                    </Dropdown.Item>
                    <Dropdown.Popover className="min-w-44">
                      <Dropdown.Menu
                        selectedKeys={implementationSelection}
                        selectionMode="single"
                        onSelectionChange={handleImplementationSelectionChange}
                      >
                        {implementationOptions.map((value) => (
                          <Dropdown.Item id={value} key={value} textValue={value}>
                            <Label>
                              {value === "all" ? "Any implementation" : capitalize(value)}
                            </Label>
                            <Dropdown.ItemIndicator />
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown.SubmenuTrigger>

                  <Dropdown.SubmenuTrigger>
                    <Dropdown.Item id="protection" textValue="Protection">
                      <Label>Protection</Label>
                      <span className="ml-auto text-xs uppercase text-muted">
                        {filters.protectionLevel}
                      </span>
                      <Dropdown.SubmenuIndicator />
                    </Dropdown.Item>
                    <Dropdown.Popover className="min-w-44">
                      <Dropdown.Menu
                        selectedKeys={protectionSelection}
                        selectionMode="single"
                        onSelectionChange={handleProtectionSelectionChange}
                      >
                        {protectionOptions.map((value) => (
                          <Dropdown.Item id={value} key={value} textValue={value}>
                            <Label>
                              {value === "all" ? "Any protection" : value.toUpperCase()}
                            </Label>
                            <Dropdown.ItemIndicator />
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown.SubmenuTrigger>

                  <Dropdown.Item
                    id="clear"
                    isDisabled={activeFilterCount === 0}
                    textValue="Clear filters"
                  >
                    <Label>Clear filters</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Content showArrow>
          <Tooltip.Arrow />
          Apply filters
        </Tooltip.Content>
      </Tooltip>

      <Tooltip delay={300}>
        <Tooltip.Trigger className="inline-flex">
          <span className="inline-flex">
            <Popover>
              <Button
                isIconOnly
                aria-label="Configure account table view"
                className="rounded-full"
                size="sm"
                variant="secondary"
              >
                <HugeiconsIcon icon={LayoutThreeColumnIcon} />
              </Button>
              <Popover.Content className="w-[22rem] p-0" placement="bottom end">
                <Popover.Dialog className="outline-none">
                  <div className="grid gap-4 p-4">
                    <Popover.Heading className="text-sm font-medium">View options</Popover.Heading>

                    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                      <Typography className="text-sm" color="muted">
                        Grouping
                      </Typography>
                      <Select
                        aria-label="Group accounts by"
                        selectedKey={grouping}
                        variant="secondary"
                        onSelectionChange={handleGroupingChange}
                      >
                        <Select.Trigger className="min-w-40">
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox items={groupingOptions}>
                            {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
                          </ListBox>
                        </Select.Popover>
                      </Select>

                      <Typography className="text-sm" color="muted">
                        Ordering
                      </Typography>
                      <div className="flex items-center gap-1.5">
                        <Tooltip delay={300}>
                          <Tooltip.Trigger>
                            <ToggleButton
                              isIconOnly
                              aria-label={
                                sort.direction === "ascending"
                                  ? "Sort ascending"
                                  : "Sort descending"
                              }
                              isSelected={sort.direction === "ascending"}
                              size="sm"
                              onChange={handleSortDirectionChange}
                            >
                              <HugeiconsIcon
                                icon={
                                  sort.direction === "ascending" ? SortByUp01Icon : SortByDown01Icon
                                }
                              />
                            </ToggleButton>
                          </Tooltip.Trigger>
                          <Tooltip.Content>Toggle sort direction</Tooltip.Content>
                        </Tooltip>
                        <Select
                          aria-label="Sort accounts by"
                          selectedKey={sort.column}
                          variant="secondary"
                          onSelectionChange={handleSortColumnChange}
                        >
                          <Select.Trigger className="min-w-32">
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox items={sortableColumns}>
                              {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-3 p-4">
                    <div>
                      <Typography weight="medium">Display properties</Typography>
                      <Typography className="text-xs" color="muted">
                        Choose the account details shown in the table.
                      </Typography>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <ToggleButton isDisabled isSelected size="sm">
                        Name
                      </ToggleButton>
                      {columnOptions.map((column) => (
                        <ColumnToggle
                          column={column}
                          isSelected={visibleColumns === "all" || visibleColumns.has(column.id)}
                          key={column.id}
                          onChange={handleColumnToggle}
                        />
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-end p-3">
                    <Button size="sm" variant="tertiary" onPress={onResetView}>
                      Reset view
                    </Button>
                  </div>
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Content showArrow>
          <Tooltip.Arrow />
          Configure view
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}

export type { AccountFilters, AccountGrouping, AccountsTableControlsProps, ColumnOption };
