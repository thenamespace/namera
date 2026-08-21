import { useMemo, useState } from "react";

import type { WalletId } from "@namera-ai/protocol";
import type {
  ListSessionKeysForOrganizationResponse,
  ListSessionKeysForWalletResponse,
  SessionKeyResponse,
} from "@namera-ai/protocol/dto";
import {
  DataGrid,
  SearchField,
  Typography,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import { Activity01Icon, HugeiconsIcon, Key01Icon, Layers01Icon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import {
  countTableValues,
  TableControls,
  TableFilterControl,
  TableViewOptions,
  toTableSelection,
  uniqueTableValues,
  type TableFilterFacet,
} from "@/components/common/table";
import { DataLoading } from "@/components/data-loading";
import { MetadataDisplay, NamespaceDisplay, SessionKeyStatusDisplay } from "@/components/display";
import { useSessionKeys, useWalletSessionKeys } from "@/hooks/session-key";

import {
  getSessionKeyChildren,
  getSessionKeyRowId,
  sessionKeyColumnIds,
  sessionKeyColumns,
  sessionKeyConfigurableColumns,
  sessionKeyFixedColumnOptions,
  sessionKeyGroupingOptions,
  sessionKeySorters,
  sessionKeySortableColumns,
  sessionKeyStatusOptions,
  type SessionKeyGrouping,
  type SessionKeyTableRow,
} from "./columns";

const emptySessionKeys: ReadonlyArray<SessionKeyResponse> = [];
const defaultSessionKeyStatuses: ReadonlySet<SessionKeyResponse["status"]> = new Set(["active"]);

type SessionKeysTableProps = { initialSessionKeys?: ListSessionKeysForOrganizationResponse };

export function SessionKeysTable({ initialSessionKeys }: SessionKeysTableProps) {
  const sessionKeys = useSessionKeys();
  return (
    <SessionKeysTableContent
      ariaLabel="Organization session keys"
      data={sessionKeys.data ?? initialSessionKeys ?? emptySessionKeys}
      isError={sessionKeys.isError}
      isInitialLoading={
        sessionKeys.isLoading && sessionKeys.data === undefined && initialSessionKeys === undefined
      }
    />
  );
}

type WalletSessionKeysTableProps = {
  initialSessionKeys?: ListSessionKeysForWalletResponse;
  walletId: WalletId;
};

export function WalletSessionKeysTable({
  initialSessionKeys,
  walletId,
}: WalletSessionKeysTableProps) {
  const sessionKeys = useWalletSessionKeys(walletId);
  return (
    <SessionKeysTableContent
      ariaLabel="Account session keys"
      data={sessionKeys.data ?? initialSessionKeys ?? emptySessionKeys}
      isError={sessionKeys.isError}
      isInitialLoading={
        sessionKeys.isLoading && sessionKeys.data === undefined && initialSessionKeys === undefined
      }
    />
  );
}

type SessionKeysTableContentProps = {
  ariaLabel: string;
  data: ReadonlyArray<SessionKeyResponse>;
  isError: boolean;
  isInitialLoading: boolean;
};

function SessionKeysTableContent({
  ariaLabel,
  data,
  isError,
  isInitialLoading,
}: SessionKeysTableContentProps) {
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<ReadonlySet<SessionKeyResponse["status"]>>(
    new Set(defaultSessionKeyStatuses),
  );
  const [accounts, setAccounts] = useState<ReadonlySet<string>>(new Set());
  const [namespaces, setNamespaces] = useState<ReadonlySet<string>>(new Set());
  const [grouping, setGrouping] = useState<SessionKeyGrouping>("none");
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
  const [visibleColumns, setVisibleColumns] = useState<DataGridSelection>(
    new Set(sessionKeyColumnIds),
  );
  const normalizedQuery = query.trim().toLowerCase();

  const statusCounts = useMemo(() => countTableValues(data, (item) => item.status), [data]);
  const accountOptions = useMemo(() => {
    const counts = countTableValues(data, (item) => item.wallet.id);
    return [...uniqueTableValues(data, (item) => item.wallet.id).values()].map((item) => ({
      id: item.wallet.id,
      label: item.wallet.metadata.name,
      content: <MetadataDisplay fallbackName="Unnamed account" metadata={item.wallet.metadata} />,
      count: counts.get(item.wallet.id) ?? 0,
    }));
  }, [data]);
  const namespaceOptions = useMemo(() => {
    const counts = countTableValues(data, (item) => item.namespace);
    return [...uniqueTableValues(data, (item) => item.namespace).values()].map((item) => ({
      id: item.namespace,
      label: item.namespace,
      content: <NamespaceDisplay namespace={item.namespace} />,
      count: counts.get(item.namespace) ?? 0,
    }));
  }, [data]);
  const filtered = useMemo(
    () =>
      data.filter((item) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [
            item.metadata.name,
            item.id,
            item.wallet.metadata.name,
            item.wallet.address,
            item.creator.user.email,
          ].some((value) => value.toLowerCase().includes(normalizedQuery));
        return (
          matchesQuery &&
          (statuses.size === 0 || statuses.has(item.status)) &&
          (accounts.size === 0 || accounts.has(item.wallet.id)) &&
          (namespaces.size === 0 || namespaces.has(item.namespace))
        );
      }),
    [accounts, data, namespaces, normalizedQuery, statuses],
  );
  const sorted = useMemo(() => {
    const sorter = sessionKeySorters[String(sort.column)];
    if (sorter === undefined) return filtered;
    const direction = sort.direction === "descending" ? -1 : 1;
    return filtered.toSorted((left, right) => sorter(left, right) * direction);
  }, [filtered, sort]);
  const rows = useMemo<SessionKeyTableRow[]>(() => {
    if (grouping === "none") return sorted;
    const grouped = new Map<string, SessionKeyResponse[]>();
    for (const item of sorted) {
      const value = grouping === "account" ? item.wallet.metadata.name : String(item[grouping]);
      grouped.set(value, [...(grouped.get(value) ?? []), item]);
    }
    return [...grouped.entries()].map(([label, children]) => ({
      children,
      grouping,
      id: `group:${grouping}:${label}`,
      kind: "group",
      label,
    }));
  }, [grouping, sorted]);
  const displayedColumns = useMemo(() => {
    const visible = visibleColumns === "all" ? new Set(sessionKeyColumnIds) : visibleColumns;
    return sessionKeyColumns.filter(
      (column) =>
        column.id === "name" || column.id === "actions" || visible.has(column.id as never),
    );
  }, [visibleColumns]);

  const facets = useMemo<ReadonlyArray<TableFilterFacet>>(
    () => [
      {
        id: "status",
        label: "Status",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Activity01Icon} />,
        defaultSelectedKeys: defaultSessionKeyStatuses,
        selectedKeys: statuses,
        options: sessionKeyStatusOptions.map((value) => ({
          id: value,
          label: value === "active" ? "Active" : "Revoked",
          content: <SessionKeyStatusDisplay status={value} />,
          count: statusCounts.get(value) ?? 0,
        })),
        onSelectionChange: (keys) => setStatuses(toTableSelection(keys, sessionKeyStatusOptions)),
      },
      {
        id: "account",
        label: "Account",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Key01Icon} />,
        selectedKeys: accounts,
        options: accountOptions,
        onSelectionChange: (keys) =>
          setAccounts(
            toTableSelection(
              keys,
              accountOptions.map((option) => option.id),
            ),
          ),
      },
      {
        id: "namespace",
        label: "Namespace",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Layers01Icon} />,
        selectedKeys: namespaces,
        options: namespaceOptions,
        onSelectionChange: (keys) =>
          setNamespaces(
            toTableSelection(
              keys,
              namespaceOptions.map((option) => option.id),
            ),
          ),
      },
    ],
    [accountOptions, accounts, namespaceOptions, namespaces, statusCounts, statuses],
  );
  const renderEmptyState = useEventCallback(() =>
    data.length === 0 ? "No session keys yet." : "No session keys match these filters.",
  );
  const resetView = useEventCallback(() => {
    setGrouping("none");
    setSort({ column: "createdAt", direction: "descending" });
    setVisibleColumns(new Set(sessionKeyColumnIds));
  });
  const clearFilters = useEventCallback(() => {
    setQuery("");
    setStatuses(new Set(defaultSessionKeyStatuses));
    setAccounts(new Set());
    setNamespaces(new Set());
  });
  const handleGroupingChange = useEventCallback((value: string) =>
    setGrouping(value as SessionKeyGrouping),
  );

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <SearchField
          aria-label="Filter session keys by name, account, creator, address, or ID"
          className="w-full sm:max-w-80"
          value={query}
          onChange={setQuery}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter session keys…" />
            <SearchField.ClearButton aria-label="Clear session key search" />
          </SearchField.Group>
        </SearchField>
        <div className="ml-auto">
          <TableControls>
            <TableFilterControl
              ariaLabel="Apply session key filters"
              facets={facets}
              onClear={clearFilters}
            />
            <TableViewOptions
              ariaLabel="Configure session key table view"
              columnOptions={sessionKeyConfigurableColumns}
              fixedColumnOptions={sessionKeyFixedColumnOptions}
              grouping={grouping}
              groupingOptions={sessionKeyGroupingOptions}
              sort={sort}
              sortableColumns={sessionKeySortableColumns}
              visibleColumns={visibleColumns}
              onGroupingChange={handleGroupingChange}
              onReset={resetView}
              onSortChange={setSort}
              onVisibleColumnsChange={setVisibleColumns}
            />
          </TableControls>
        </div>
      </div>

      {isError ? (
        <Typography className="text-danger">Couldn’t load session keys.</Typography>
      ) : null}
      {isInitialLoading ? (
        <DataLoading className="min-h-64" label="Loading session keys" />
      ) : (
        <DataGrid
          aria-label={ariaLabel}
          columns={displayedColumns}
          data={rows}
          defaultExpandedKeys="all"
          getRowId={getSessionKeyRowId}
          key={grouping}
          renderEmptyState={renderEmptyState}
          sortDescriptor={sort}
          variant="secondary"
          onSortChange={setSort}
          {...(grouping === "none" ? {} : { getChildren: getSessionKeyChildren })}
        />
      )}
    </div>
  );
}

export type { SessionKeysTableProps, WalletSessionKeysTableProps };
