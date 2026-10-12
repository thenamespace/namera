// oxlint-disable react-perf/jsx-no-new-function-as-prop
// oxlint-disable react-perf/jsx-no-new-object-as-prop
import { useCallback, useMemo, useState, type Key } from "react";

import { Link, useNavigate } from "@tanstack/react-router";

import type { ContractInterfaceSummary } from "@namera-ai/protocol/dto";
import {
  Button,
  DataGrid,
  Dropdown,
  Label,
  SearchField,
  Typography,
  type DataGridColumn,
} from "@namera-ai/ui";
import {
  ArrowUpRight01Icon,
  Copy01Icon,
  HugeiconsIcon,
  MoreHorizontalIcon,
} from "@namera-ai/ui/icons";

import { useInterfaces } from "@/hooks/interfaces";

import { copyCatalogValue } from "../catalog/catalog-actions";

function InterfaceActions({ artifact }: { artifact: ContractInterfaceSummary }) {
  const navigate = useNavigate();
  const onAction = useCallback(
    (key: Key) => {
      if (key === "view")
        void navigate({ to: "/interface/$interfaceId", params: { interfaceId: artifact.id } });
      if (key === "copy") void copyCatalogValue(artifact.id, "Interface ID");
    },
    [navigate, artifact.id],
  );
  return (
    <Dropdown>
      <Button
        size="sm"
        variant="tertiary"
        isIconOnly
        aria-label={`Actions for interface ${artifact.id}`}
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} />
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={onAction}>
          <Dropdown.Item id="view" textValue="View page">
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-4" />
            <Label>View page</Label>
          </Dropdown.Item>
          <Dropdown.Item id="copy" textValue="Copy ID">
            <HugeiconsIcon icon={Copy01Icon} className="size-4" />
            <Label>Copy ID</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
const columns: DataGridColumn<ContractInterfaceSummary>[] = [
  {
    id: "name",
    header: "Name",
    isRowHeader: true,
    minWidth: 290,
    width: "1fr",
    cell: (artifact) => (
      <Link
        to="/interface/$interfaceId"
        params={{ interfaceId: artifact.id }}
        className="text-sm font-medium no-underline"
      >
        {artifact.data.name}
      </Link>
    ),
  },
  {
    id: "format",
    header: "Format",
    width: 110,
    cell: () => <span className="text-sm">EVM ABI</span>,
  },
  {
    id: "source",
    header: "Source",
    minWidth: 200,
    width: "1fr",
    cell: (artifact) => (
      <a
        href={artifact.sourceUrl.href}
        title={artifact.sourceUrl.href}
        target="_blank"
        rel="noreferrer"
        className="text-accent truncate text-sm underline"
      >
        {artifact.sourceUrl.hostname}
      </a>
    ),
  },
  {
    id: "hash",
    header: "Content hash",
    width: 170,
    cell: (artifact) => (
      <code className="text-muted text-xs" title={artifact.contentHash}>
        {artifact.contentHash.slice(0, 8)}…{artifact.contentHash.slice(-8)}
      </code>
    ),
  },
  {
    id: "actions",
    header: "",
    width: 48,
    align: "end",
    pinned: "end",
    cell: (artifact) => <InterfaceActions artifact={artifact} />,
  },
];
const getId = (artifact: ContractInterfaceSummary) => artifact.id;

export function InterfacesTable() {
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const result = useInterfaces({ offset, ...(query.trim() ? { query: query.trim() } : {}) });
  const rows = useMemo(() => [...(result.data?.entries ?? [])], [result.data]);
  const next = result.data?.nextOffset;
  return (
    <div className="grid min-w-0 gap-5">
      <div>
        <Typography.Heading level={2} weight="medium" className="text-2xl">
          Interfaces
        </Typography.Heading>
        <p className="text-muted mt-1 text-sm">
          Shared contract ABIs used by address catalog deployments.
        </p>
      </div>
      <SearchField
        aria-label="Search interfaces"
        className="w-full sm:max-w-80"
        value={query}
        onChange={(value) => {
          setQuery(value);
          setOffset(0);
        }}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Search name, ID, source, or hash…" maxLength={200} />
          <SearchField.ClearButton aria-label="Clear interface search" />
        </SearchField.Group>
      </SearchField>
      {result.error ? (
        <div role="alert">
          <p>Couldn’t load interfaces.</p>
          <Button size="sm" variant="tertiary" onPress={result.refetch}>
            Try again
          </Button>
        </div>
      ) : !result.data ? (
        <output className="text-muted text-sm">Loading interfaces…</output>
      ) : rows.length ? (
        <DataGrid
          aria-label="Contract interfaces"
          columns={columns}
          data={rows}
          getRowId={getId}
          variant="secondary"
        />
      ) : (
        <p className="text-muted py-12 text-center text-sm">
          {query.trim()
            ? "No interfaces match this search."
            : offset
              ? "No more interfaces. Go back to the previous page."
              : "No interfaces yet. Interfaces are added through catalog uploads."}
        </p>
      )}
      {offset > 0 || (next !== null && next !== undefined) ? (
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted mr-2 text-xs">Page {Math.floor(offset / 25) + 1}</span>
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={!offset || result.isFetching}
            onPress={() => setOffset(Math.max(0, offset - 25))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={next === null || next === undefined || result.isFetching}
            onPress={() => {
              if (next !== null && next !== undefined) setOffset(next);
            }}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
