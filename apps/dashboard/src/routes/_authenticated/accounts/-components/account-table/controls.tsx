import {
  Button,
  ListBox,
  Popover,
  Select,
  Separator,
  Tooltip,
  Typography,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import {
  HugeiconsIcon,
  LayoutThreeColumnIcon,
  SortByDown01Icon,
  SortByUp01Icon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { AccountFilterMenu, type AccountFilterCounts, type AccountFilters } from "./filter-menu";

const groupingOptions = [
  { id: "none", label: "No grouping" },
  { id: "status", label: "Status" },
  { id: "implementation", label: "Implementation" },
  { id: "protectionLevel", label: "Protection" },
] as const;

type AccountGrouping = (typeof groupingOptions)[number]["id"];

type ColumnOption = {
  id: string;
  label: string;
};

type AccountsTableControlsProps = {
  columnOptions: ReadonlyArray<ColumnOption>;
  filterCounts: AccountFilterCounts;
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

type ColumnToggleProps = {
  column: ColumnOption;
  isSelected: boolean;
  onChange: (id: string, selected: boolean) => void;
};

function ColumnToggle({ column, isSelected, onChange }: ColumnToggleProps) {
  const handlePress = useEventCallback(() => {
    onChange(column.id, !isSelected);
  });

  return (
    <Button
      aria-pressed={isSelected}
      className={isSelected ? "h-7 px-2 text-xs" : "h-7 px-2 text-xs opacity-50"}
      size="sm"
      variant="tertiary"
      onPress={handlePress}
    >
      {column.label}
    </Button>
  );
}

export function AccountsTableControls({
  columnOptions,
  filterCounts,
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
  const handleGroupingChange = useEventCallback((key: string | number | null) => {
    if (typeof key === "string") onGroupingChange(key as AccountGrouping);
  });
  const handleSortColumnChange = useEventCallback((key: string | number | null) => {
    if (key !== null) onSortChange({ ...sort, column: key });
  });
  const toggleSortDirection = useEventCallback(() => {
    onSortChange({
      ...sort,
      direction: sort.direction === "ascending" ? "descending" : "ascending",
    });
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
            <AccountFilterMenu counts={filterCounts} filters={filters} onChange={onFiltersChange} />
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
                variant="tertiary"
              >
                <HugeiconsIcon icon={LayoutThreeColumnIcon} />
              </Button>
              <Popover.Content className="w-96 p-0" placement="bottom end">
                <Popover.Dialog className="outline-none">
                  <div className="grid gap-3 p-3">
                    <Popover.Heading className="text-sm font-medium">View options</Popover.Heading>

                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <Typography className="text-sm" color="muted">
                        Grouping
                      </Typography>
                      <Select
                        aria-label="Group accounts by"
                        selectedKey={grouping}
                        variant="secondary"
                        onSelectionChange={handleGroupingChange}
                      >
                        <Select.Trigger className="h-7 min-w-32 px-2 text-xs">
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
                            <Button
                              isIconOnly
                              aria-label={
                                sort.direction === "ascending"
                                  ? "Sort ascending"
                                  : "Sort descending"
                              }
                              className="size-7 min-h-7"
                              size="sm"
                              variant="secondary"
                              onPress={toggleSortDirection}
                            >
                              <HugeiconsIcon
                                icon={
                                  sort.direction === "ascending" ? SortByUp01Icon : SortByDown01Icon
                                }
                              />
                            </Button>
                          </Tooltip.Trigger>
                          <Tooltip.Content>Toggle sort direction</Tooltip.Content>
                        </Tooltip>
                        <Select
                          aria-label="Sort accounts by"
                          selectedKey={sort.column}
                          variant="secondary"
                          onSelectionChange={handleSortColumnChange}
                        >
                          <Select.Trigger className="h-7 min-w-28 px-2 text-xs">
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

                  <div className="grid gap-2.5 p-3">
                    <div>
                      <Typography className="text-sm" weight="medium">
                        Display properties
                      </Typography>
                      <Typography className="text-xs" color="muted">
                        Choose the account details shown in the table.
                      </Typography>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        isDisabled
                        aria-pressed="true"
                        className="h-7 px-2 text-xs opacity-100"
                        size="sm"
                        variant="tertiary"
                      >
                        Name
                      </Button>
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

                  <div className="flex justify-end p-2.5">
                    <Button
                      className="h-7 px-2 text-xs"
                      size="sm"
                      variant="tertiary"
                      onPress={onResetView}
                    >
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

export type { AccountGrouping, AccountsTableControlsProps, ColumnOption };
