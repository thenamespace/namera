import type { DataGridSelection, DataGridSortDescriptor } from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";

import {
  TableControls,
  TableFilterControl,
  TableViewOptions,
  type TableOption,
} from "@/components/common/table";

import { AccountFilterMenu, type AccountFilterCounts, type AccountFilters } from "./filter-menu";

const groupingOptions = [
  { id: "none", label: "No grouping" },
  { id: "status", label: "Status" },
  { id: "protectionLevel", label: "Protection" },
] as const;

type AccountGrouping = (typeof groupingOptions)[number]["id"];
const fixedColumnOptions = [{ id: "name", label: "Name" }] as const;

type AccountsTableControlsProps = {
  columnOptions: ReadonlyArray<TableOption>;
  filterCounts: AccountFilterCounts;
  filters: AccountFilters;
  grouping: AccountGrouping;
  sort: DataGridSortDescriptor;
  sortableColumns: ReadonlyArray<TableOption>;
  visibleColumns: DataGridSelection;
  onFiltersChange: (filters: AccountFilters) => void;
  onGroupingChange: (grouping: AccountGrouping) => void;
  onResetView: () => void;
  onSortChange: (sort: DataGridSortDescriptor) => void;
  onVisibleColumnsChange: (columns: DataGridSelection) => void;
};

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
  const handleGroupingChange = useEventCallback((value: string) => {
    onGroupingChange(value as AccountGrouping);
  });

  return (
    <TableControls>
      <TableFilterControl
        {...AccountFilterMenu({ counts: filterCounts, filters, onChange: onFiltersChange })}
      />
      <TableViewOptions
        ariaLabel="Configure account table view"
        columnOptions={columnOptions}
        fixedColumnOptions={fixedColumnOptions}
        grouping={grouping}
        groupingOptions={groupingOptions}
        sort={sort}
        sortableColumns={sortableColumns}
        visibleColumns={visibleColumns}
        onGroupingChange={handleGroupingChange}
        onReset={onResetView}
        onSortChange={onSortChange}
        onVisibleColumnsChange={onVisibleColumnsChange}
      />
    </TableControls>
  );
}

export type { AccountGrouping, AccountsTableControlsProps };
