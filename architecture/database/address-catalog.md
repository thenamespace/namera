# Address catalog

The global curated address catalog currently has protocol schemas, Drizzle tables,
relations, a migration, and schema/constraint tests only. It accepts the `eip155`
namespace and `erc20` / `contract` data variants. No repository, search query,
curation workflow, API, UI, policy integration or seed data is implemented.

Sources: `packages/protocol/src/model/catalog/`,
`packages/database/src/schema/core/catalog/`, and
`packages/database/src/relations/catalog.ts`.

## `core.address_catalog`

One namespace-scoped resource, such as a token or a specific contract product.

| Column                     | Type / nullability    | Meaning                                           |
| -------------------------- | --------------------- | ------------------------------------------------- |
| `id`                       | text PK               | UUIDv7 application default; branded catalog ID    |
| `namespace`                | text, required        | Only `eip155`                                     |
| `slug`                     | text, required        | Lowercase alphanumeric, hyphen-separated identity |
| `search`                   | text[], required      | Derived search terms; no database default         |
| `search_text`              | text, required        | Internal text projection for trigram search       |
| `data`                     | jsonb, required       | Version 1 `erc20` or `contract` metadata          |
| `status`                   | text, required        | `draft` (default), `published`, `archived`        |
| `revision`                 | integer, required     | Positive; default 1                               |
| `created_at`, `updated_at` | timestamptz, required | Shared timestamp defaults/update behavior         |

Metadata shares `display` with name, optional logo/description/website, aliases
and tags. ERC-20 `details` contains a symbol. Contract `details` has optional
protocol and contract-version labels. No ABI or interface reference belongs here.

Unique constraints: `(namespace, slug)` and `(id, namespace)` (the entry FK target).
Checks enforce namespace, lifecycle, positive revision, slug syntax, JSON object
shape, version, allowed discriminator, display/details objects, ERC-20 symbol
presence/type and absence of inline ABI/interface fields.

The partial GIN index `address_catalog_search_trgm_idx` uses `gin_trgm_ops` on
`search_text` for published rows. The migration chain already installs `pg_trgm`.
There is no automatic search-term derivation yet. Future writers must update
`data`, `search` and `search_text` together. Protocol row models omit internal
`search_text`; select explicit fields before strict decoding.

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
applicable. Protocol address schemas accept EVM casing; future writers must
normalize the persisted address to lowercase before insertion.

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
compute the hash, prove provenance, or prohibit UPDATEs. Future writers must
canonicalize JSON, calculate/verify the hash, confirm equality on deduplication,
and treat documents as immutable. An upgrade assigns a new/reused interface ID
only to explicitly reviewed entries; it never overwrites a shared document.

`EvmJsonAbi` validates modern JSON ABI functions, constructors, events, errors,
fallback and receive items, Solidity parameter types and recursive tuple components.
It accepts at most 2,048 items, 256 parameters/components per list, eight tuple
levels and 256 characters per parameter type. Non-tuple components are rejected.
Legacy ABI shapes are not automatically normalized. Decode untrusted catalog and
interface payloads with `onExcessProperty: "error"` to reject unknown fields rather
than silently dropping them. Request-byte limits and canonical hash computation
belong to the future ingestion workflow, not to these table definitions.

## Remaining boundaries

- Repositories and transactional curation: validate parent/entry type agreement,
  preserve resource identity, increment/check revisions, maintain search text,
  enforce immutable interfaces and re-establish verification after reassignment.
- Publication rules, authorization and transactional audit events. No mutation
  API exists yet, so no new audit event or runtime telemetry is emitted here.
- Search must read only catalog/entry metadata, not join ABI documents. Null
  interface IDs support metadata-only entries, not unverified function selection.
- Full JSON validation is the protocol boundary; SQL enforces structural/identity
  checks but does not duplicate every nested field rule. Schema validity alone
  neither verifies a deployment nor grants permission to call it.
- JSON metadata is persisted using encoded schemas (URL/DateTime strings);
  decoded persistence timestamps follow the existing DateTime-from-Date convention.
- Other namespaces, IDL formats, NFT-specific variants and repositories are out of scope.

## Verification

Protocol tests cover both variants, evidence encoding, invalid IDs/chains/units,
strict field rejection, all ABI item kinds, tuples and nesting bounds.
PGlite tests apply the real migration chain and cover shared interfaces,
multiple deployments per chain, relations/reset ordering, unique/FK/delete
constraints and invalid direct SQL writes. Query-plan performance and concurrency
are not claimed; no search or mutation workflow exists to benchmark yet.
