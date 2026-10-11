# Address catalog

The global curated address catalog supports `eip155` and `erc20` / `contract`
records. Protocol schemas, tables, transaction-aware repositories, discovery
routes and an operator JSON import workflow are implemented. UI, seed data,
SDK convenience methods and policy-page integration remain separate work.

Sources: `packages/protocol/src/model/catalog/`,
`packages/database/src/schema/core/catalog/`, and
`packages/database/src/relations/catalog.ts`.

## `core.address_catalog`

One namespace-scoped resource, such as a token or a specific contract product.

| Column                     | Type / nullability    | Meaning                                            |
| -------------------------- | --------------------- | -------------------------------------------------- |
| `id`                       | text PK               | UUIDv7 application default; branded catalog ID     |
| `namespace`                | text, required        | Only `eip155`                                      |
| `slug`                     | text, required        | Lowercase alphanumeric, hyphen-separated identity  |
| `search`                   | text[], required      | Operator-curated search terms from the import JSON |
| `search_text`              | text, required        | Internal text projection for trigram search        |
| `data`                     | jsonb, required       | Version 1 `erc20` or `contract` metadata           |
| `status`                   | text, required        | `draft` (default), `published`, `archived`         |
| `revision`                 | integer, required     | Positive; default 1                                |
| `created_at`, `updated_at` | timestamptz, required | Shared timestamp defaults/update behavior          |

Metadata shares `display` with required name and logo, optional description/website,
aliases and tags. Logos are CDN-relative paths matching
`address-catalog/<lowercase-name>.(svg|png|webp)`, with optional nested folders such
as `address-catalog/eip155/erc20/usdc.png`, not full URLs. Folder and file names
contain only lowercase letters, digits and hyphens; empty segments, traversal,
query strings and fragments are rejected. Both resource types
require a logo at import and persistence decoding boundaries; the operator uploads
the asset to the CDN separately. Existing records without logos must be corrected
before being read with this schema. ERC-20 `details` contains a symbol. Contract `details` has optional
protocol and contract-version labels. No ABI or interface reference belongs here.

Unique constraints: `(namespace, slug)` and `(id, namespace)` (the entry FK target).
Checks enforce namespace, lifecycle, positive revision, slug syntax, JSON object
shape, version, allowed discriminator, display/details objects, ERC-20 symbol
presence/type and absence of inline ABI/interface fields.

The partial GIN index `address_catalog_search_trgm_idx` uses `gin_trgm_ops` on
`search_text` for published rows. The migration chain already installs `pg_trgm`.
Imports preserve supplied `search` terms and set `search_text = search.join(" ")`
in the same write. No keywords are generated from metadata. Protocol row models
omit internal `search_text`; repository decoding strips this internal projection.

## `core.address_catalog_entry`

A concrete deployment; several entries may share a parent, chain, or interface.

| Column                     | Type / nullability    | Meaning                                        |
| -------------------------- | --------------------- | ---------------------------------------------- |
| `id`                       | text PK               | UUIDv7 application default; branded entry ID   |
| `catalog_id`               | text, required        | Parent identity                                |
| `namespace`                | text, required        | Only `eip155`; repeated for composite FK       |
| `chain_id`                 | text, required        | One of the eight supported EVM CAIP-2 IDs      |
| `address`                  | text, required        | Lowercase 20-byte `0x` address                 |
| `interface_id`             | text, nullable        | Explicit shared interface; no parent fallback  |
| `data`                     | jsonb, required       | Version 1 `erc20` / `contract` deployment data |
| `status`                   | text, required        | `disabled` (default), `active`, `deprecated`   |
| `revision`                 | integer, required     | Positive; default 1                            |
| `created_at`, `updated_at` | timestamptz, required | Shared timestamp behavior                      |

ERC-20 data requires integer decimals from 0 to 255; contract data has no decimals.
Both may include verification with HTTPS source URL, checked-at ISO timestamp and
optional implementation address. The main address remains the called proxy when
applicable. Imports normalize the deployment address to lowercase; resolution
and complete-address search are case-insensitive.

Unique `(namespace, chain_id, address)` prevents duplicate address identities.
There is deliberately no unique `(catalog_id, chain_id)` constraint. Composite
`(catalog_id, namespace)` references `address_catalog(id, namespace)` with restricted
deletion. `interface_id` references `contract_interface(id)` with restricted deletion.

Checks enforce namespace, supported chains, canonical address shape/case, status,
positive revision, object/version/type data, valid ERC-20 decimals, no contract
decimals, and no inline ABI/interface fields in JSON. Supported IDs match
`SupportedEvmChainId`: 1, 10, 8453, 42161, 84532, 421614, 11155111, 11155420 under
`eip155`. Update this constraint with the protocol union when adding a chain.

Indexes:

- `(catalog_id, namespace)` for parent references across all statuses.
- `(catalog_id, chain_id)` for active rows and future picker existence filtering.
- `interface_id` for reverse interface usage and FK checks.

## `core.contract_interface`

Large reusable JSON interface documents are separate from searchable metadata.

| Column         | Type / nullability    | Meaning                                          |
| -------------- | --------------------- | ------------------------------------------------ |
| `id`           | text PK               | UUIDv7 application default; branded interface ID |
| `format`       | text, required        | Only `evm-abi`                                   |
| `document`     | jsonb, required       | JSON ABI array                                   |
| `content_hash` | text, required        | 64 lowercase hex characters; intended SHA-256    |
| `source_url`   | text, required        | Original artifact source                         |
| `created_at`   | timestamptz, required | Defaults to now; no update timestamp             |

Unique `(format, content_hash)` supports document reuse. SQL checks format,
document array shape and hash shape. SQL does not validate individual ABI items,
compute the hash, prove provenance, or prohibit UPDATEs. The import workflow sorts
JSON object keys recursively, preserves array order, and computes a SHA-256 hex
digest. Existing interface records are immutable through imports. A hash belonging
to another ID is reported as a conflict containing the reusable ID; it is never
silently remapped. An upgrade assigns a new/reused interface ID only to explicitly
reviewed entries and never overwrites a shared document.

`EvmJsonAbi` validates modern JSON ABI functions, constructors, events, errors,
fallback and receive items, Solidity parameter types and recursive tuple components.
It accepts at most 2,048 items, 256 parameters/components per list, eight tuple
levels and 256 characters per parameter type. Non-tuple components are rejected.
Legacy ABI shapes are not automatically normalized. The import endpoint sets
`HttpApi.PayloadParseOptions` to `onExcessProperty: "error"`, including nested
fields. The existing server limit caps uploads at 2 MiB before unbounded allocation.

## Discovery API

| Endpoint                               | Result                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `GET /catalog`                         | `{ entries: CatalogView[], nextOffset: number \| null }`               |
| `GET /catalog/:catalogId`              | Catalog metadata with active deployments                               |
| `GET /catalog/entries/:entryId`        | `{ catalog, entry }`                                                   |
| `POST /catalog/resolve`                | Input-order address records with `{ catalog, entry }` or `match: null` |
| `GET /catalog/interfaces/:interfaceId` | Complete interface artifact, including ABI                             |

These are authenticated product routes, not anonymous downloads. Users require
`wallet:read`, CLI actors require `wallet:read`, and MCP actors require `mcp:read`;
API keys require valid authentication. Catalog data is global, not tenant-owned,
so reads do not require a wallet/session grant. Middleware still enforces active
credentials and OAuth audiences/scopes. Internal routes accept no machine credentials.

Search requires `namespace=eip155`; optional `chainId` uses supported CAIP-2 IDs.
`types` is an optional repeated query parameter, for example
`types=erc20&types=contract`. Omission includes both; empty arrays are invalid.
`query` is capped at 200 characters, `limit` defaults to 20 (maximum 100), and
`offset` defaults to 0 (maximum 10,000). Offset pagination is stable for unchanged
records, not a snapshot across concurrent imports.

Filters apply before pagination using a matching active-deployment EXISTS query.
Only published parents and active entries are returned. Search ranks exact symbols,
names and curated terms before prefixes, substrings and trigram word-similarity
matches; fuzzy matching starts at three characters. Name and ID break ties.
Wildcards are escaped and all values parameterized. Complete addresses use exact
lowercase deployment equality. An omitted chain searches across supported networks.
Matching deployment lists are fetched once for the page, not once per parent.
Search and resolution never join or return ABI documents.

Resolve accepts `{ addresses: [{ namespace, chainId, address }] }`, with 1–100
records. It preserves order and duplicates. Unknown addresses, hidden records and
wrong-chain matches return `match: null`; malformed addresses fail validation.
No RPC lookup or automatic enrichment is performed. Interface reads return 404
unless an active entry under a published parent references that interface.

## Operator import

`POST /internal/catalog/import?dryRun=true` previews a complete upload; omit
`dryRun` or use `false` to persist it. The body has this shape:

```json
{
  "version": 1,
  "interfaces": [],
  "catalog": [],
  "entries": []
}
```

Each supplied record is a complete replacement of its editable fields, not a
patch. Catalog records contain `id`, `namespace`, `slug`, `search`, `data` and
`status`. Entries contain `id`, `catalogId`, `namespace`, `chainId`, `address`,
nullable `interfaceId`, `data` and `status`. Interfaces contain `id`, `format`,
`document` and `sourceUrl`. IDs are caller-supplied UUIDv7 values. Timestamps,
revisions, search-text projections and content hashes are server-owned and must
not be supplied. The file version and each record's data version are independent.

Upload at most 500 parents, 2,000 entries and 100 interfaces per request; split
larger datasets into dependency-ordered batches. Each parent supplies 1–64 search
terms, each 1–128 characters. Absent records stay untouched; explicitly archive
parents or disable entries to withdraw them. There is no delete endpoint.

Owner membership with `catalog:manage` is required, plus the normal
verified session and exact trusted Origin. The handler uses the existing admin
write limit (60/hour/member). Imports acquire the platform transaction lock,
recheck membership, validate references against both stored and incoming records,
then insert interfaces and upsert changed parents/entries atomically. The lock
serializes imports across replicas and coordinates with platform role mutations.
Dry runs validate under the same lock without writing or auditing; they do not
reserve identities for a later upload.

Duplicate IDs, slugs, addresses and ABI hashes are rejected with a typed 409 error
containing the collection, record ID, field and explanation. Parent namespace/type
and entry deployment identity (parent/namespace/chain/address) cannot be reassigned
under an existing ID. Entry data must match the parent's resource type. Changing
an interface reference requires renewed verification or removal of old evidence.
Database failures remain defects and roll back the entire upload, including audit.

Unchanged records preserve timestamps and revisions. Changed parents/entries
increment their revision once; uploads are serialized last-write-wins, not
optimistic edits from multiple administrators. Successful changes append one
`catalog.imported` platform event with changed record IDs in the same transaction.
No-op imports and dry runs do not append events. Responses report created,
updated and unchanged counts per collection (interfaces have no updated count).
Existing HTTP telemetry and stable workflow spans cover this low-volume operation;
there are no payload logs, notifications or new metric series.

Repositories are available through `Repository.core.catalog`, `.catalogEntry`
and `.contractInterface`. They own persistence/decoding; the application owns
publication visibility, cross-record validation, diffing, hashing and transactions.
Write methods are internal primitives: callers must use the import workflow to
obtain its locking, immutability and audit guarantees.

## Admin listing

`GET /internal/catalog` requires active platform membership with `catalog:read`
(owner, operator or viewer). It includes every lifecycle status and all deployments,
including parents without entries; ABI documents remain separate. It accepts the
discovery filters plus optional parent `status`, uses literal substring metadata
search or exact address matching, and sorts by slug/ID. Pagination defaults to 25
records with a next offset. Reads recheck membership and do not create audit events.
Public discovery visibility remains unchanged.

## Remaining boundaries

- Null
  interface IDs support metadata-only entries, not unverified function selection.
- Full JSON validation is the protocol boundary; SQL enforces structural/identity
  checks but does not duplicate every nested field rule. Schema validity alone
  neither verifies a deployment nor grants permission to call it.
- JSON metadata is persisted using encoded schemas (URL/DateTime strings);
  decoded persistence timestamps follow the existing DateTime-from-Date convention.
- Other namespaces, IDL formats, NFT-specific variants, onchain verification and
  automatic unknown-address enrichment are out of scope.

## Verification

Protocol tests cover both variants, evidence encoding, invalid IDs/chains/units,
strict field rejection, all ABI item kinds, tuples and nesting bounds.
PGlite tests apply the real migration chain and cover shared interfaces,
multiple deployments per chain, relations/reset ordering, unique/FK/delete
constraints and invalid direct SQL writes. Server tests exercise real repositories,
schemas, handlers and imports, including search, address resolution, visibility,
idempotence, strict raw JSON validation, permissions and audit rollback. The
disposable PostgreSQL lane also races eight identical imports and verifies one
creation, seven no-ops and one audit event. Production
query plans should be measured with the actual seed dataset before adding indexes.
