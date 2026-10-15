# Address catalog

The catalog is curated EVM metadata, not wallet ownership or an authorization
allowlist. It separates a named asset/contract from its chain deployments and ABI.

| Table                        | Purpose and important constraints                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core.address_catalog`       | Unique namespace/slug, typed display/details, search text and revision. Status is draft, published or archived. Published search uses a trigram GIN index. |
| `core.address_catalog_entry` | Deployment unique by namespace/chain/address. Lowercase EVM addresses provide case-insensitive identity. Entry and catalog namespaces must match.          |
| `core.contract_interface`    | ABI document and attribution; unique format/content hash. Format is `evm-abi`, document is a JSON array, hash is 64 lowercase hexadecimal characters.      |

Catalog and deployment payloads are versioned `erc20` or `contract` objects.
Token decimals range from 0 to 255; contract records cannot contain token decimals.
ABIs are referenced separately and cannot be embedded as metadata overrides.
Deployment statuses are active, deprecated and disabled.

Authenticated discovery exposes published metadata and appropriate deployment
views. ABI retrieval is separate from search. Internal import validates the full
document and supports dry run before an atomic update; internal listing includes
non-public statuses. No external ABI URL is fetched merely because it is stored
as attribution.

Source: [schema](../../packages/database/src/schema/core/catalog/),
[application](../../packages/application/src/catalog/),
[transport](../../apps/server/src/routes/catalog.ts).
