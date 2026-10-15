import { useMemo, useState } from "react";

import type { SessionKeyId, WalletId } from "@namera-ai/protocol";
import type { ExecutionListItemResponse, ListExecutionsResponse } from "@namera-ai/protocol/dto";
import {
  DataGrid,
  SearchField,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";

import { TableControls, TableFilterControl, TableViewOptions } from "@/components/common/table";
import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import { useExecutions, useSessionKeyExecutions, useWalletExecutions } from "@/hooks/execution";

import {
  executionColumnIds,
  executionColumns,
  executionConfigurableColumns,
  executionFixedColumnOptions,
  executionGroupingOptions,
  executionSorters,
  executionSortableColumns,
  getExecutionChildren,
  getExecutionRowId,
  type ExecutionGrouping,
  type ExecutionTableRow,
} from "./columns";
import { useExecutionFilters, type ExecutionTableScope } from "./use-execution-filters";

const emptyExecutions: ReadonlyArray<ExecutionListItemResponse> = [];

type ExecutionsTableProps = {
  initialExecutions?: ListExecutionsResponse;
  variant?: "default" | "summary";
};

type ScopedExecutionsTableProps = {
  initialExecutions?: ListExecutionsResponse;
};

type ExecutionsQueryState = {
  readonly refetch: () => void;
  readonly isFetching: boolean;
  readonly data: ListExecutionsResponse | undefined;
  readonly isError: boolean;
  readonly isLoading: boolean;
};

type ExecutionsTableContentProps = {
  executions: ExecutionsQueryState;
  initialExecutions?: ListExecutionsResponse;
  scope: ExecutionTableScope;
  variant?: "default" | "summary";
};

function ExecutionsTableContent({
  executions,
  initialExecutions,
  scope,
  variant = "default",
}: ExecutionsTableContentProps) {
  const items = executions.data?.items ?? initialExecutions?.items ?? emptyExecutions;
  const isInitialLoading =
    executions.isLoading && executions.data === undefined && initialExecutions === undefined;
  const { query, setQuery, filtered, facets, hasFilters, clearFilters } = useExecutionFilters(
    items,
    scope,
  );
  const [grouping, setGrouping] = useState<ExecutionGrouping>("none");
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
  const [visibleColumns, setVisibleColumns] = useState<DataGridSelection>(
    new Set(executionColumnIds),
  );
  const fixedColumnId =
    scope === "organization" ? "account" : scope === "wallet" ? "sessionKey" : "namespace";

  const sorted = useMemo(() => {
    const sorter = executionSorters[String(sort.column)];
    if (sorter === undefined) return filtered;
    const direction = sort.direction === "descending" ? -1 : 1;
    return filtered.toSorted((left, right) => sorter(left, right) * direction);
  }, [filtered, sort]);
  const rows = useMemo<ExecutionTableRow[]>(() => {
    if (grouping === "none") return variant === "summary" ? sorted.slice(0, 5) : sorted;
    const grouped = new Map<string, ExecutionListItemResponse[]>();

    for (const item of sorted) {
      const value =
        grouping === "account"
          ? item.wallet.id
          : grouping === "sessionKey"
            ? item.sessionKey.id
            : grouping === "namespace"
              ? item.details.namespace
              : grouping === "chain"
                ? item.details.chainId
                : item.actorType;
      grouped.set(value, [...(grouped.get(value) ?? []), item]);
    }

    return [...grouped.entries()].map(([value, children]) => ({
      children,
      grouping,
      id: `group:${grouping}:${value}`,
      kind: "group",
      value,
    }));
  }, [grouping, sorted, variant]);
  const displayedColumns = useMemo(() => {
    const visible = visibleColumns === "all" ? new Set(executionColumnIds) : visibleColumns;
    const columns = executionColumns.filter(
      (column) =>
        !(scope !== "organization" && column.id === "account") &&
        !(scope === "session-key" && column.id === "sessionKey") &&
        (column.id === fixedColumnId || column.id === "actions" || visible.has(column.id as never)),
    );
    const fixedColumnIndex = columns.findIndex((column) => column.id === fixedColumnId);
    const fixedColumn = columns[fixedColumnIndex];
    if (fixedColumn === undefined) return columns;

    return columns.toSpliced(fixedColumnIndex, 1, {
      ...fixedColumn,
      isRowHeader: true,
      pinned: "start" as const,
      width: "1fr" as const,
    });
  }, [fixedColumnId, scope, visibleColumns]);

  const groupingOptions = useMemo(
    () =>
      executionGroupingOptions.filter(
        (option) =>
          (scope === "organization" || option.id !== "account") &&
          (scope !== "session-key" || option.id !== "sessionKey"),
      ),
    [scope],
  );
  const columnOptions = useMemo(
    () =>
      executionConfigurableColumns.filter(
        (option) =>
          (scope === "organization" || option.id !== "account") &&
          (scope !== "session-key" || option.id !== "sessionKey") &&
          option.id !== fixedColumnId,
      ),
    [fixedColumnId, scope],
  );
  const fixedColumnOptions = useMemo(
    () =>
      scope === "organization"
        ? executionFixedColumnOptions
        : [{ id: fixedColumnId, label: scope === "wallet" ? "Session key" : "Namespace" }],
    [fixedColumnId, scope],
  );
  const sortableColumns = useMemo(
    () =>
      executionSortableColumns.filter(
        (option) =>
          (scope === "organization" || option.id !== "account") &&
          (scope !== "session-key" || option.id !== "sessionKey"),
      ),
    [scope],
  );
  const renderEmptyState = useEventCallback(() =>
    hasFilters ? "No executions match these filters." : "No confirmed executions yet.",
  );
  const resetView = useEventCallback(() => {
    setGrouping("none");
    setSort({ column: "createdAt", direction: "descending" });
    setVisibleColumns(new Set(executionColumnIds));
  });
  const handleGroupingChange = useEventCallback((value: string) => {
    setGrouping(value as ExecutionGrouping);
  });

  return (
    <div className="grid gap-5">
      {variant === "default" ? (
        <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
          <SearchField
            aria-label="Filter executions by wallet, session key, chain, actor, hash, or ID"
            className="w-full sm:max-w-80"
            value={query}
            onChange={setQuery}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Filter executions…" />
              <SearchField.ClearButton aria-label="Clear execution search" />
            </SearchField.Group>
          </SearchField>
          <div className="ml-auto">
            <TableControls>
              <TableFilterControl
                ariaLabel="Apply execution filters"
                facets={facets}
                onClear={clearFilters}
              />
              <TableViewOptions
                ariaLabel="Configure execution table view"
                columnOptions={columnOptions}
                fixedColumnOptions={fixedColumnOptions}
                grouping={grouping}
                groupingOptions={groupingOptions}
                sort={sort}
                sortableColumns={sortableColumns}
                visibleColumns={visibleColumns}
                onGroupingChange={handleGroupingChange}
                onReset={resetView}
                onSortChange={setSort}
                onVisibleColumnsChange={setVisibleColumns}
              />
            </TableControls>
          </div>
        </div>
      ) : null}

      {executions.isError ? (
        <DataError
          compact
          label="executions"
          onRetry={executions.refetch}
          isRetrying={executions.isFetching}
        />
      ) : null}
      {isInitialLoading ? (
        <DataLoading className="min-h-64" label="Loading executions" />
      ) : (
        <DataGrid
          aria-label="Confirmed executions"
          columns={displayedColumns}
          data={rows}
          defaultExpandedKeys="all"
          getRowId={getExecutionRowId}
          key={grouping}
          renderEmptyState={renderEmptyState}
          sortDescriptor={sort}
          variant="secondary"
          onSortChange={setSort}
          {...(grouping === "none" ? {} : { getChildren: getExecutionChildren })}
        />
      )}
    </div>
  );
}

export function ExecutionsTable({ initialExecutions, variant }: ExecutionsTableProps) {
  const executions = useExecutions();
  return (
    <ExecutionsTableContent
      executions={executions}
      scope="organization"
      {...(initialExecutions === undefined ? {} : { initialExecutions })}
      {...(variant === undefined ? {} : { variant })}
    />
  );
}

export function WalletExecutionsTable({
  walletId,
  initialExecutions,
}: ScopedExecutionsTableProps & { walletId: WalletId }) {
  const executions = useWalletExecutions(walletId);
  return (
    <ExecutionsTableContent
      executions={executions}
      scope="wallet"
      {...(initialExecutions === undefined ? {} : { initialExecutions })}
    />
  );
}

export function SessionKeyExecutionsTable({
  sessionKeyId,
  initialExecutions,
}: ScopedExecutionsTableProps & { sessionKeyId: SessionKeyId }) {
  const executions = useSessionKeyExecutions(sessionKeyId);
  return (
    <ExecutionsTableContent
      executions={executions}
      scope="session-key"
      {...(initialExecutions === undefined ? {} : { initialExecutions })}
    />
  );
}

export type { ExecutionsTableProps, ScopedExecutionsTableProps };
