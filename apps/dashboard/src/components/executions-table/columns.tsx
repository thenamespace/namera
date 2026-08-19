import { useMemo } from "react";

import { Link } from "@tanstack/react-router";

import { DateTime } from "effect";

import type { ExecutionListItemResponse } from "@namera-ai/protocol/dto";
import type { DataGridColumn } from "@namera-ai/ui";
import { ArrowUpRight01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import type { TableOption } from "@/components/common/table";
import {
  ChainDisplay,
  DateDisplay,
  ExecutionActorDisplay,
  MetadataDisplay,
  NamespaceDisplay,
} from "@/components/display";

import { ExecutionActions } from "./actions";
import { getActorLabel, getExecutionChain, getTransactionUrl } from "./data";

export const executionColumnIds = [
  "namespace",
  "chain",
  "sessionKey",
  "actor",
  "txHash",
  "createdAt",
] as const;
export const executionGroupingOptions = [
  { id: "none", label: "No grouping" },
  { id: "account", label: "Account" },
  { id: "sessionKey", label: "Session key" },
  { id: "namespace", label: "Namespace" },
  { id: "chain", label: "Chain" },
  { id: "actor", label: "Called by" },
] as const;

export type ExecutionGrouping = (typeof executionGroupingOptions)[number]["id"];
export type ExecutionGroupRow = {
  children: ReadonlyArray<ExecutionListItemResponse>;
  grouping: Exclude<ExecutionGrouping, "none">;
  id: string;
  kind: "group";
  value: string;
};
export type ExecutionTableRow = ExecutionListItemResponse | ExecutionGroupRow;

export const isExecutionGroup = (row: ExecutionTableRow): row is ExecutionGroupRow => "kind" in row;
export const getExecutionRowId = (row: ExecutionTableRow) =>
  isExecutionGroup(row) ? row.id : row.details.id;
export const getExecutionChildren = (row: ExecutionTableRow) =>
  isExecutionGroup(row) ? [...row.children] : undefined;

function GroupLabel({ row }: { row: ExecutionGroupRow }) {
  const first = row.children[0];
  if (first === undefined) return null;

  return (
    <span className="flex min-w-0 items-center gap-2">
      {row.grouping === "account" ? (
        <MetadataDisplay fallbackName="Unnamed account" metadata={first.wallet.metadata} />
      ) : row.grouping === "sessionKey" ? (
        <MetadataDisplay fallbackName="Unnamed session key" metadata={first.sessionKey.metadata} />
      ) : row.grouping === "namespace" ? (
        <NamespaceDisplay namespace={first.details.namespace} />
      ) : row.grouping === "chain" ? (
        <ChainDisplay chainId={first.details.chainId} />
      ) : (
        <ExecutionActorDisplay type={first.actorType} />
      )}
      <span className="text-xs tabular-nums text-muted">{row.children.length}</span>
    </span>
  );
}

function AccountCell({ item }: { item: ExecutionListItemResponse }) {
  const params = useMemo(() => ({ accountId: item.wallet.id }), [item.wallet.id]);
  return (
    <Link
      className="block min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      params={params}
      to="/account/$accountId/overview"
    >
      <MetadataDisplay fallbackName="Unnamed account" metadata={item.wallet.metadata} />
    </Link>
  );
}

function SessionKeyCell({ item }: { item: ExecutionListItemResponse }) {
  const params = useMemo(() => ({ sessionKeyId: item.sessionKey.id }), [item.sessionKey.id]);
  return (
    <Link
      className="block min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      params={params}
      to="/session-key/$sessionKeyId/overview"
    >
      <MetadataDisplay fallbackName="Unnamed session key" metadata={item.sessionKey.metadata} />
    </Link>
  );
}

function TransactionCell({ item }: { item: ExecutionListItemResponse }) {
  const hash = item.details.transactionHash;
  const transactionUrl = getTransactionUrl(item);
  const compactHash = `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  const content = (
    <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
      <span className="truncate">{compactHash}</span>
      {transactionUrl === undefined ? null : (
        <HugeiconsIcon className="size-3.5 shrink-0 text-muted" icon={ArrowUpRight01Icon} />
      )}
    </span>
  );
  return transactionUrl === undefined ? (
    <span title={hash}>{content}</span>
  ) : (
    <a
      className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      href={transactionUrl}
      rel="noopener noreferrer"
      target="_blank"
      title={hash}
    >
      {content}
    </a>
  );
}

export const executionColumns: ReadonlyArray<DataGridColumn<ExecutionTableRow>> = [
  {
    allowsSorting: true,
    cell: (row) => (isExecutionGroup(row) ? <GroupLabel row={row} /> : <AccountCell item={row} />),
    header: "Wallet",
    id: "account",
    isRowHeader: true,
    minWidth: 170,
    pinned: "start",
    width: "1fr",
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isExecutionGroup(row) ? null : <NamespaceDisplay namespace={row.details.namespace} />,
    header: "Namespace",
    id: "namespace",
    minWidth: 115,
    width: 140,
  },
  {
    allowsSorting: true,
    cell: (row) => (isExecutionGroup(row) ? null : <ChainDisplay chainId={row.details.chainId} />),
    header: "Chain",
    id: "chain",
    minWidth: 145,
    width: 180,
  },
  {
    allowsSorting: true,
    cell: (row) => (isExecutionGroup(row) ? null : <SessionKeyCell item={row} />),
    header: "Session key",
    id: "sessionKey",
    minWidth: 170,
    width: 210,
  },
  {
    allowsSorting: true,
    cell: (row) => (isExecutionGroup(row) ? null : <ExecutionActorDisplay type={row.actorType} />),
    header: "Called by",
    id: "actor",
    minWidth: 110,
    width: 130,
  },
  {
    allowsSorting: true,
    cell: (row) => (isExecutionGroup(row) ? null : <TransactionCell item={row} />),
    header: "Transaction",
    id: "txHash",
    minWidth: 150,
    width: 180,
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isExecutionGroup(row) ? null : <DateDisplay label="Executed" value={row.details.createdAt} />,
    header: "Executed",
    id: "createdAt",
    minWidth: 130,
    width: 150,
  },
  {
    align: "center",
    allowsSorting: false,
    cell: (row) => (isExecutionGroup(row) ? null : <ExecutionActions execution={row} />),
    cellClassName: "px-1",
    header: <span className="sr-only">Actions</span>,
    headerClassName: "px-1",
    id: "actions",
    maxWidth: 48,
    minWidth: 48,
    pinned: "end",
    width: 48,
  },
];

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
export const executionSorters: Record<
  string,
  (left: ExecutionListItemResponse, right: ExecutionListItemResponse) => number
> = {
  account: (left, right) => collator.compare(left.wallet.metadata.name, right.wallet.metadata.name),
  namespace: (left, right) => collator.compare(left.details.namespace, right.details.namespace),
  chain: (left, right) =>
    collator.compare(
      getExecutionChain(left)?.chain.name ?? left.details.chainId,
      getExecutionChain(right)?.chain.name ?? right.details.chainId,
    ),
  sessionKey: (left, right) =>
    collator.compare(left.sessionKey.metadata.name, right.sessionKey.metadata.name),
  actor: (left, right) => collator.compare(getActorLabel(left), getActorLabel(right)),
  txHash: (left, right) =>
    collator.compare(left.details.transactionHash, right.details.transactionHash),
  createdAt: (left, right) =>
    DateTime.toEpochMillis(left.details.createdAt) -
    DateTime.toEpochMillis(right.details.createdAt),
};

export const executionConfigurableColumns: ReadonlyArray<TableOption> = executionColumns
  .filter((column) => executionColumnIds.includes(column.id as (typeof executionColumnIds)[number]))
  .map((column) => ({ id: column.id, label: String(column.header) }));
export const executionSortableColumns: ReadonlyArray<TableOption> = executionColumns
  .filter((column) => column.allowsSorting)
  .map((column) => ({ id: column.id, label: String(column.header) }));
export const executionFixedColumnOptions = [{ id: "account", label: "Wallet" }] as const;
