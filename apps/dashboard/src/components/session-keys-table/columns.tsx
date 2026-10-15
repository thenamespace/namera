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
import { SessionKeyCustodyDisplay } from "@/components/display/session-key-custody-display";
import { sessionKeyDisplayStatus } from "@/components/display/session-key-status-display";
import { sessionKeyCreatorPresentation, sessionKeyCreatorName } from "@/lib/session-key-creator";

import { SessionKeyActions } from "./actions";

export const sessionKeyColumnIds = [
  "account",
  "namespace",
  "custody",
  "creator",
  "status",
  "createdAt",
] as const;
export const sessionKeyStatusOptions = ["active", "pending", "revoked"] as const;
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
    cell: (row) =>
      isSessionKeyGroup(row) ? null : <SessionKeyCustodyDisplay custody={row.signer.custody} />,
    header: "Custody",
    id: "custody",
    minWidth: 150,
    width: 170,
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
        <MetadataDisplay {...sessionKeyCreatorPresentation(row.creator)} />
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
  status: (left, right) =>
    collator.compare(sessionKeyDisplayStatus(left.status), sessionKeyDisplayStatus(right.status)),
  account: (left, right) => collator.compare(left.wallet.metadata.name, right.wallet.metadata.name),
  creator: (left, right) =>
    collator.compare(sessionKeyCreatorName(left.creator), sessionKeyCreatorName(right.creator)),
  namespace: (left, right) => collator.compare(left.namespace, right.namespace),
  custody: (left, right) => collator.compare(left.signer.custody, right.signer.custody),
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
