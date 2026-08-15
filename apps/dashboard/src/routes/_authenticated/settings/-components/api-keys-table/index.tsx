import { useMemo, useState } from "react";

import { DateTime } from "effect";

import type {
  ApiKeyResponse,
  ListApiKeysResponse,
  ListSessionKeysForOrganizationResponse,
} from "@namera-ai/protocol/dto";
import { Chip, DataGrid, SearchField, Typography, type DataGridColumn } from "@namera-ai/ui";

import { DateDisplay, MetadataDisplay } from "@/components/display";
import { useApiKeys } from "@/hooks/api-key";

import { ApiKeyActions } from "./api-key-actions";
import { CreateApiKeyDialog } from "./create-api-key-dialog";

const apiKeyCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const getStatus = (apiKey: ApiKeyResponse) => {
  if (apiKey.revokedAt !== null) return "revoked" as const;
  if (apiKey.expiresAt !== null && DateTime.toEpochMillis(apiKey.expiresAt) <= Date.now()) {
    return "expired" as const;
  }
  return "active" as const;
};

const createApiKeyColumns = (canRevoke: boolean): DataGridColumn<ApiKeyResponse>[] => [
  {
    allowsSorting: true,
    cell: (apiKey) => <MetadataDisplay fallbackName="Unnamed API key" metadata={apiKey.metadata} />,
    header: "Name",
    id: "name",
    isRowHeader: true,
    minWidth: 150,
    sortFn: (left, right) => apiKeyCollator.compare(left.metadata.name, right.metadata.name),
  },
  {
    allowsSorting: true,
    cell: (apiKey) => <code className="text-muted text-xs">{apiKey.keyStart}…</code>,
    header: "Key",
    id: "keyStart",
    minWidth: 110,
    sortFn: (left, right) => apiKeyCollator.compare(left.keyStart, right.keyStart),
  },
  {
    allowsSorting: true,
    cell: ({ creator }) => (
      <MetadataDisplay fallbackName={creator.user.email} metadata={creator.user.metadata} />
    ),
    header: "Created by",
    id: "creator",
    minWidth: 150,
    sortFn: (left, right) =>
      apiKeyCollator.compare(
        left.creator.user.metadata.name ?? left.creator.user.email,
        right.creator.user.metadata.name ?? right.creator.user.email,
      ),
  },
  {
    allowsSorting: true,
    cell: ({ sessionKeys }) => (
      <Typography className="text-sm!" color="muted">
        {sessionKeys.length} session key{sessionKeys.length === 1 ? "" : "s"}
      </Typography>
    ),
    header: "Access",
    id: "sessionKeys",
    minWidth: 130,
    sortFn: (left, right) => left.sessionKeys.length - right.sessionKeys.length,
  },
  {
    allowsSorting: true,
    cell: (apiKey) => {
      const status = getStatus(apiKey);
      return (
        <Chip color={status === "active" ? "success" : "default"} size="sm" variant="soft">
          <Chip.Label className="capitalize font-normal">{status}</Chip.Label>
        </Chip>
      );
    },
    header: "Status",
    id: "status",
    minWidth: 100,
    sortFn: (left, right) => apiKeyCollator.compare(getStatus(left), getStatus(right)),
  },
  {
    allowsSorting: true,
    cell: ({ expiresAt }) =>
      expiresAt ? (
        <DateDisplay label="Expires" value={expiresAt} />
      ) : (
        <Typography className="text-sm!" color="muted">
          Never
        </Typography>
      ),
    header: "Valid until",
    id: "expiresAt",
    minWidth: 120,
    sortFn: (left, right) =>
      (left.expiresAt ? DateTime.toEpochMillis(left.expiresAt) : Number.POSITIVE_INFINITY) -
      (right.expiresAt ? DateTime.toEpochMillis(right.expiresAt) : Number.POSITIVE_INFINITY),
  },
  {
    allowsSorting: true,
    cell: ({ createdAt }) => <DateDisplay label="Created" value={createdAt} />,
    header: "Created",
    id: "createdAt",
    minWidth: 110,
    sortFn: (left, right) =>
      DateTime.toEpochMillis(left.createdAt) - DateTime.toEpochMillis(right.createdAt),
  },
  ...(canRevoke
    ? [
        {
          align: "end" as const,
          cell: (apiKey: ApiKeyResponse) => <ApiKeyActions apiKey={apiKey} />,
          header: "",
          id: "actions",
          pinned: "end" as const,
          width: 48,
        },
      ]
    : []),
];

const getApiKeyId = (apiKey: ApiKeyResponse) => apiKey.id;
const renderEmptyState = () => "No API keys found.";

type ApiKeysTableProps = {
  canCreate: boolean;
  canRevoke: boolean;
  initialApiKeys: ListApiKeysResponse;
  initialSessionKeys: ListSessionKeysForOrganizationResponse;
};

export function ApiKeysTable({
  canCreate,
  canRevoke,
  initialApiKeys,
  initialSessionKeys,
}: ApiKeysTableProps) {
  const apiKeys = useApiKeys();
  const apiKeyData = apiKeys.data ?? initialApiKeys;
  const [query, setQuery] = useState("");
  const columns = useMemo(() => createApiKeyColumns(canRevoke), [canRevoke]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleApiKeys = useMemo(
    () =>
      apiKeyData.filter((apiKey) => {
        const creatorName = apiKey.creator.user.metadata.name?.toLowerCase() ?? "";
        return (
          apiKey.metadata.name.toLowerCase().includes(normalizedQuery) ||
          apiKey.keyStart.toLowerCase().includes(normalizedQuery) ||
          creatorName.includes(normalizedQuery) ||
          apiKey.creator.user.email.toLowerCase().includes(normalizedQuery)
        );
      }),
    [apiKeyData, normalizedQuery],
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          aria-label="Filter API keys"
          className="w-full sm:max-w-80"
          value={query}
          onChange={setQuery}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter API keys..." />
            <SearchField.ClearButton aria-label="Clear API key filter" />
          </SearchField.Group>
        </SearchField>
        {canCreate ? <CreateApiKeyDialog initialSessionKeys={initialSessionKeys} /> : null}
      </div>

      {apiKeys.isLoading ? <Typography color="muted">Loading API keys…</Typography> : null}
      {apiKeys.isError ? (
        <Typography className="text-danger">Couldn’t load API keys.</Typography>
      ) : null}
      <DataGrid
        aria-label="Organization API keys"
        columns={columns}
        contentClassName="min-w-[780px]"
        data={visibleApiKeys}
        getRowId={getApiKeyId}
        renderEmptyState={renderEmptyState}
        variant="secondary"
      />
    </div>
  );
}
