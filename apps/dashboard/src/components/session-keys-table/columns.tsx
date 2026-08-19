import { useMemo } from "react";

import { Link } from "@tanstack/react-router";

import { DateTime } from "effect";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import type { DataGridColumn } from "@namera-ai/ui";

import type { TableOption } from "@/components/common/table";
import {
  DateDisplay,
  MetadataDisplay,
  NamespaceDisplay,
  SessionKeyStatusDisplay,
} from "@/components/display";

import { SessionKeyActions } from "./actions";

export const sessionKeyColumnIds = [
  "account",
  "namespace",
  "creator",
  "status",
  "createdAt",
] as const;
export const sessionKeyStatusOptions = ["active", "revoked"] as const;
export const sessionKeyGroupingOptions = [
  { id: "none", label: "No grouping" },
  { id: "status", label: "Status" },
  { id: "account", label: "Account" },
  { id: "namespace", label: "Namespace" },
] as const;

export type SessionKeyGrouping = (typeof sessionKeyGroupingOptions)[number]["id"];
export type SessionKeyGroupRow = {
  children: ReadonlyArray<SessionKeyResponse>;
  grouping: Exclude<SessionKeyGrouping, "none">;
  id: string;
  kind: "group";
  label: string;
};
export type SessionKeyTableRow = SessionKeyResponse | SessionKeyGroupRow;

const isSessionKeyGroup = (row: SessionKeyTableRow): row is SessionKeyGroupRow => "kind" in row;

export const getSessionKeyRowId = (row: SessionKeyTableRow) => row.id;
export const getSessionKeyChildren = (row: SessionKeyTableRow) =>
  isSessionKeyGroup(row) ? [...row.children] : undefined;

function GroupLabel({ row }: { row: SessionKeyGroupRow }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {row.grouping === "status" ? (
        <SessionKeyStatusDisplay status={row.label as SessionKeyResponse["status"]} />
      ) : row.grouping === "namespace" ? (
        <NamespaceDisplay namespace={row.label as SessionKeyResponse["namespace"]} />
      ) : (
        row.label
      )}
      <span className="text-xs tabular-nums text-muted">{row.children.length}</span>
    </span>
  );
}

function SessionKeyNameCell({ sessionKey }: { sessionKey: SessionKeyResponse }) {
  const params = useMemo(() => ({ sessionKeyId: sessionKey.id }), [sessionKey.id]);
  return (
    <Link
      className="block min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      params={params}
      to="/session-key/$sessionKeyId/overview"
    >
      <MetadataDisplay fallbackName="Unnamed session key" metadata={sessionKey.metadata} />
    </Link>
  );
}

export const sessionKeyColumns: ReadonlyArray<DataGridColumn<SessionKeyTableRow>> = [
  {
    allowsSorting: true,
    cell: (row) =>
      isSessionKeyGroup(row) ? <GroupLabel row={row} /> : <SessionKeyNameCell sessionKey={row} />,
    header: "Name",
    id: "name",
    isRowHeader: true,
    minWidth: 160,
    pinned: "start",
    width: "1fr",
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isSessionKeyGroup(row) ? null : (
        <MetadataDisplay fallbackName="Unnamed account" metadata={row.wallet.metadata} />
      ),
    header: "Account",
    id: "account",
    minWidth: 150,
    width: 190,
  },
  {
    allowsSorting: true,
    cell: (row) => (isSessionKeyGroup(row) ? null : <NamespaceDisplay namespace={row.namespace} />),
    header: "Namespace",
    id: "namespace",
    minWidth: 120,
    width: 150,
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isSessionKeyGroup(row) ? null : (
        <MetadataDisplay
          fallbackName={row.creator.user.email}
          metadata={row.creator.user.metadata}
        />
      ),
    header: "Created by",
    id: "creator",
    minWidth: 150,
    width: 190,
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isSessionKeyGroup(row) ? null : <SessionKeyStatusDisplay status={row.status} />,
    header: "Status",
    id: "status",
    minWidth: 100,
    width: 120,
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isSessionKeyGroup(row) ? null : <DateDisplay label="Created" value={row.createdAt} />,
    header: "Created",
    id: "createdAt",
    minWidth: 130,
    width: 150,
  },
  {
    align: "center",
    allowsSorting: false,
    cell: (row) => (isSessionKeyGroup(row) ? null : <SessionKeyActions sessionKey={row} />),
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
export const sessionKeySorters: Record<
  string,
  (left: SessionKeyResponse, right: SessionKeyResponse) => number
> = {
  name: (left, right) => collator.compare(left.metadata.name, right.metadata.name),
  status: (left, right) => collator.compare(left.status, right.status),
  account: (left, right) => collator.compare(left.wallet.metadata.name, right.wallet.metadata.name),
  creator: (left, right) =>
    collator.compare(
      left.creator.user.metadata.name ?? left.creator.user.email,
      right.creator.user.metadata.name ?? right.creator.user.email,
    ),
  namespace: (left, right) => collator.compare(left.namespace, right.namespace),
  createdAt: (left, right) =>
    DateTime.toEpochMillis(left.createdAt) - DateTime.toEpochMillis(right.createdAt),
};
export const sessionKeyConfigurableColumns: ReadonlyArray<TableOption> = sessionKeyColumns
  .filter((column) =>
    sessionKeyColumnIds.includes(column.id as (typeof sessionKeyColumnIds)[number]),
  )
  .map((column) => ({ id: column.id, label: String(column.header) }));
export const sessionKeySortableColumns: ReadonlyArray<TableOption> = sessionKeyColumns
  .filter((column) => column.allowsSorting)
  .map((column) => ({ id: column.id, label: String(column.header) }));
export const sessionKeyFixedColumnOptions = [{ id: "name", label: "Name" }] as const;
