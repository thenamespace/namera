// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useMemo, useState } from "react";

import {
  Button,
  DataGrid,
  ListBox,
  SearchField,
  Select,
  Typography,
  type DataGridColumn,
} from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { PermissionGuard, manageCatalogPermission } from "@/components/permission";
import { useCatalog } from "@/hooks/catalog";

import { InviteDate } from "../invites/invite-display";
import { CatalogActions } from "./catalog-actions";
import { CatalogIdentity, CatalogStatus, type CatalogRecord } from "./catalog-display";
import { ImportCatalogDialog } from "./import-dialog";

const statuses = [
  { id: "all", label: "All statuses" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Draft" },
  { id: "archived", label: "Archived" },
] as const;
const types = [
  { id: "all", label: "All types" },
  { id: "erc20", label: "ERC-20 tokens" },
  { id: "contract", label: "Contracts" },
] as const;
const getId = (record: CatalogRecord) => record.id;

const columns: DataGridColumn<CatalogRecord>[] = [
  {
    id: "name",
    header: "Name",
    isRowHeader: true,
    minWidth: 240,
    width: "1fr",
    cell: (record) => <CatalogIdentity record={record} />,
  },
  {
    id: "type",
    header: "Type",
    width: 110,
    cell: (record) => (
      <span className="text-muted text-sm">
        {record.data.type === "erc20" ? "ERC-20" : "Contract"}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: 145,
    cell: (record) => <CatalogStatus status={record.status} />,
  },
  {
    id: "updated",
    header: "Updated",
    width: 135,
    cell: (record) => <InviteDate label="Updated" value={record.updatedAt} />,
  },
  {
    id: "actions",
    header: "",
    width: 48,
    align: "end",
    pinned: "end",
    cell: (record) => <CatalogActions record={record} />,
  },
];

export function CatalogTable() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]["id"]>("all");
  const [type, setType] = useState<(typeof types)[number]["id"]>("all");
  const [offset, setOffset] = useState(0);
  const [uploading, setUploading] = useState(false);
  const catalog = useCatalog({
    namespace: "eip155",
    offset,
    ...(query.trim() ? { query: query.trim() } : {}),
    ...(status === "all" ? {} : { status }),
    ...(type === "all" ? {} : { types: [type] }),
  });
  const rows = useMemo(() => [...(catalog.data?.entries ?? [])], [catalog.data]);
  const filtered = Boolean(query.trim()) || status !== "all" || type !== "all";
  const nextOffset = catalog.data?.nextOffset;

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Heading level={2} weight="medium" className="text-2xl">
            Address Catalog
          </Typography.Heading>
          <p className="text-muted mt-1 text-sm">
            Tokens, contracts, and their network deployments.
          </p>
        </div>
        <PermissionGuard required={manageCatalogPermission}>
          <Button size="sm" onPress={() => setUploading(true)}>
            <HugeiconsIcon icon={Add01Icon} />
            Upload JSON
          </Button>
        </PermissionGuard>
      </div>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          aria-label="Search address catalog"
          value={query}
          className="w-full sm:max-w-80"
          onChange={(value) => {
            setQuery(value);
            setOffset(0);
          }}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search name, symbol, or address…" maxLength={200} />
            <SearchField.ClearButton aria-label="Clear catalog search" />
          </SearchField.Group>
        </SearchField>
        <Select
          aria-label="Filter by status"
          selectedKey={status}
          variant="secondary"
          className="w-full sm:w-44"
          onSelectionChange={(key) => {
            const option = statuses.find((item) => item.id === key);
            if (option) {
              setStatus(option.id);
              setOffset(0);
            }
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox items={statuses}>
              {(option) => (
                <ListBox.Item id={option.id} textValue={option.label}>
                  {option.label}
                </ListBox.Item>
              )}
            </ListBox>
          </Select.Popover>
        </Select>
        <Select
          aria-label="Filter by type"
          selectedKey={type}
          variant="secondary"
          className="w-full sm:w-44"
          onSelectionChange={(key) => {
            const option = types.find((item) => item.id === key);
            if (option) {
              setType(option.id);
              setOffset(0);
            }
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox items={types}>
              {(option) => (
                <ListBox.Item id={option.id} textValue={option.label}>
                  {option.label}
                </ListBox.Item>
              )}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
      {catalog.error ? (
        <div role="alert" className="flex items-center gap-3 text-sm">
          <p>Couldn’t load the address catalog.</p>
          <Button size="sm" variant="tertiary" onPress={catalog.refetch}>
            Try again
          </Button>
        </div>
      ) : catalog.isPending && !catalog.data ? (
        <output className="text-muted text-sm">Loading address catalog…</output>
      ) : rows.length === 0 ? (
        <div className="text-muted py-12 text-center text-sm">
          {filtered
            ? "No records match these filters."
            : offset
              ? "No more records. Go back to the previous page."
              : "No catalog records yet. The owner can upload a catalog JSON file to get started."}
        </div>
      ) : (
        <DataGrid
          aria-label="Address catalog"
          columns={columns}
          data={rows}
          getRowId={getId}
          variant="secondary"
        />
      )}
      {offset > 0 ||
      (catalog.data?.nextOffset !== null && catalog.data?.nextOffset !== undefined) ? (
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted mr-2 text-xs">Page {Math.floor(offset / 25) + 1}</span>
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={!offset || catalog.isFetching}
            onPress={() => setOffset(Math.max(0, offset - 25))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={nextOffset === null || nextOffset === undefined || catalog.isFetching}
            onPress={() => {
              if (nextOffset !== null && nextOffset !== undefined) setOffset(nextOffset);
            }}
          >
            Next
          </Button>
        </div>
      ) : null}
      <PermissionGuard required={manageCatalogPermission}>
        {uploading ? <ImportCatalogDialog onClose={() => setUploading(false)} /> : null}
      </PermissionGuard>
    </div>
  );
}
