# Blockscout data-enrichment provider

## Status

Implemented for address metadata and fungible portfolio reads. Namera uses
Blockscout PRO for these surfaces while Alchemy remains the EVM RPC, Bundler,
account-construction, execution, simulation, and signing provider.

Implemented boundaries:

- provider-neutral protocol metadata and portfolio schemas;
- `core.address_metadata`, migration, constraints, search indexes, and repository;
- Blockscout transport, response decoding, normalization, timeouts, and partial failures;
- read-through metadata application cache with 30-day stable and 24-hour volatile TTLs;
- exact, batch, search, explicit portfolio, and wallet portfolio HTTP routes;
- account assets dashboard with summaries, charts, rich filters, grouping, and pagination.

The design intentionally keeps Blockscout response types inside the EVM package.
Protocol and public API schemas expose only Namera-normalized namespace unions.

## Goals

- Resolve raw addresses into consistent address pills throughout Namera.
- Support local, fast searches such as `USDC` or `Circle` when configuring a
  call policy.
- Build a priced multi-chain fungible portfolio with useful spam separation.
- Enrich transaction and UserOperation activity with decoded calls, assets,
  counterparties, protocol labels, and human-readable summaries.
- Cache durable address identity and contract metadata in PostgreSQL.
- Preserve a provider-neutral public contract so another namespace can use a
  different provider without leaking Blockscout shapes.
- Keep provider credentials and raw provider failures on the server.

## Non-goals

- Blockscout is not an execution, simulation, signing, or Bundler provider.
- Provider responses are not public API DTOs.
- Current balances, prices, transaction history, or portfolio totals are not
  stored in the address metadata table.
- Source verification is not interpreted as proof that a contract is safe.
- A total historical portfolio-value chart cannot be reconstructed from a
  current balance response. It requires periodic Namera-owned snapshots.

## Provider facts verified against the live API

Blockscout PRO accepts one credential for per-chain REST, Etherscan-compatible,
JSON-RPC, metadata, and multichain services. Namera should send the key as an
`Authorization: Bearer <key>` header. Query-string `apikey` remains accepted by
many REST examples, but the server adapter should use the header consistently so
credentials never enter URLs or logs.

Per-chain REST uses:

```text
https://api.blockscout.com/{numericChainId}/api/v2/{resource}
```

The metadata service uses:

```text
https://api.blockscout.com/services/metadata/api/v1/{resource}
```

The multichain service uses:

```text
https://api.blockscout.com/multichain/api/v1/clusters/multichain/{resource}
```

Live address-detail requests succeeded for all eight Namera launch chains:

| Namera chain     | Numeric chain ID | Per-chain REST | Multichain search cluster |
| ---------------- | ---------------: | -------------- | ------------------------- |
| Ethereum         |                1 | Yes            | Yes                       |
| Optimism         |               10 | Yes            | Yes                       |
| Base             |             8453 | Yes            | Yes                       |
| Arbitrum One     |            42161 | Yes            | Yes                       |
| Ethereum Sepolia |         11155111 | Yes            | No                        |
| Optimism Sepolia |         11155420 | Yes            | No                        |
| Base Sepolia     |            84532 | Yes            | No                        |
| Arbitrum Sepolia |           421614 | Yes            | No                        |

The multichain cluster currently covers Namera's four mainnets. Testnet search
must use the selected chain's REST search endpoint. Chain availability must come
from the Namera chain registry; Blockscout discovery must not silently expand
the product's supported-chain set.

The high-level Metadata Service guide contains older route examples such as
`/metadata/api/v1/addresses/{address}`. The generated API reference and the live
service use `/services/metadata/api/v1/metadata`, `/tags:search`, `/addresses`,
and `/reputation`. Implement against the generated reference and validate every
response with Effect Schema.

Official references:

- [PRO API](https://docs.blockscout.com/devs/pro-api)
- [Multichain Service](https://docs.blockscout.com/devs/multichain-service)
- [Metadata Service](https://docs.blockscout.com/devs/metadata-service)
- [Wallet history](https://docs.blockscout.com/devs/wallet-history)
- [REST API](https://docs.blockscout.com/devs/apis/rest)
- [Interpreter API](https://docs.blockscout.com/devs/apis/rest/interpreter-api)
- [Generated metadata endpoint reference](https://docs.blockscout.com/api-reference/metadata/get-servicesmetadataapiv1metadata)

## Endpoint catalog

Only endpoints with a concrete Namera use are included. Chain-specific explorer
statistics, validator, rollup, bridge, and CSV endpoints do not belong in the
data-enrichment integration.

### Discovery and search

| Endpoint                                                            | Important upstream response                                                                                   | Namera use                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `GET /multichain/api/v1/clusters/multichain/chains`                 | Chain records with numeric IDs and explorer configuration                                                     | Health-check the provider and observe coverage; never define supported Namera chains from it |
| `GET /multichain/api/v1/clusters/multichain/search:quick?q={query}` | Arrays named `tokens`, `addresses`, `transactions`, `blocks`, `block_numbers`, `nfts`, `domains`, and `dapps` | Mainnet token/address autocomplete and a future universal dashboard search                   |
| `GET /{chain}/api/v2/search?q={query}`                              | Chain-local token, address, contract, block, and transaction matches                                          | Selected-chain and testnet autocomplete                                                      |
| `GET /{chain}/api/v2/search/quick?q={query}`                        | Short, unpaginated chain-local matches                                                                        | Low-latency selected-chain search where supported                                            |

A live `USDC` multichain result includes approximately:

```ts
interface BlockscoutMultichainToken {
  readonly address_hash: string;
  readonly symbol: string | null;
  readonly name: string | null;
  readonly type: string | null;
  readonly icon_url: string | null;
  readonly exchange_rate: string | null;
  readonly chain_infos: Readonly<
    Record<
      string,
      {
        readonly holders_count: string | null;
        readonly total_supply: string | null;
        readonly is_verified: boolean | null;
        readonly contract_name: string | null;
      }
    >
  >;
}
```

One result can represent deployments on one or more numeric chains. Normalize
it into one Namera candidate per `(namespace, chainId, address)` before ranking.

### Address identity and metadata

| Endpoint                                                                               | Important upstream response                                                                                                 | Namera use                                                                    |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `GET /{chain}/api/v2/addresses/{address}`                                              | Native balance/rate, ENS, name, contract flags, scam and reputation flags, token summary, proxy type, implementations, tags | Primary exact-address enrichment and native portfolio row                     |
| `GET /services/metadata/api/v1/metadata?addresses={csv}&chainId={id}&tagsLimit={n}`    | Map keyed by address; each value has ordered tags                                                                           | Batch name, protocol, category, description, icon, and credibility enrichment |
| `GET /services/metadata/api/v1/reputation?addresses={csv}&chainId={id}`                | Address-keyed reputation values when known                                                                                  | Supplemental reputation signal, never the only trust signal                   |
| `GET /services/metadata/api/v1/tags:search?chain_id={id}&tag_types={csv}&name={query}` | Tag matches containing the tag and associated addresses                                                                     | Protocol/category/name autocomplete and local-cache warming                   |
| `GET /services/metadata/api/v1/addresses?slug={slug}&tagType={type}&chainId={id}`      | Addresses associated with one tag                                                                                           | Resolve a selected tag such as `usdc`, `circle`, or `stablecoin`              |
| `GET /services/metadata/api/v1/public-tag-types`                                       | Supported tag type IDs, names, and descriptions                                                                             | Diagnostics only; Namera owns its normalized tag vocabulary                   |

The live address response is structurally similar to:

```ts
interface BlockscoutAddress {
  readonly hash: string;
  readonly coin_balance: string | null;
  readonly exchange_rate: string | null;
  readonly ens_domain_name: string | null;
  readonly name: string | null;
  readonly is_contract: boolean | null;
  readonly is_verified: boolean | null;
  readonly is_scam: boolean;
  readonly reputation: "ok" | "scam";
  readonly proxy_type: string | null;
  readonly implementations: ReadonlyArray<{
    readonly address_hash: string;
    readonly name: string | null;
  }>;
  readonly metadata: { readonly tags: ReadonlyArray<unknown> } | null;
  readonly public_tags: ReadonlyArray<unknown>;
  readonly token: BlockscoutTokenSummary | null;
}
```

The metadata batch response is structurally similar to:

```ts
interface BlockscoutAddressMetadataBatch {
  readonly addresses: Readonly<
    Record<
      string,
      {
        readonly tags: ReadonlyArray<{
          readonly slug: string;
          readonly name: string;
          readonly tagType: string;
          readonly ordinal: number;
          readonly meta: string;
        }>;
      }
    >
  >;
}
```

`meta` is a JSON-encoded string, not an object. Decode it separately and bound
its size before normalization. It can contain project names, descriptions,
links, icon URLs, colors, token attributes, attribution, or large data URLs.
Namera must not persist data URLs or arbitrary presentation colors. Unknown or
missing addresses are omitted from the response, so batch mapping must retain
the original request set.

For Ethereum USDC, the live service returned name, generic, protocol, and token
reputation tags corresponding to USD Coin, stablecoin, Circle, and a credible
token. This is richer than the standalone reputation response, which may be
empty. Trust normalization must combine address flags, token reputation, and
metadata tags.

### Fungible portfolio

| Endpoint                                                     | Important upstream response                                                               | Namera use                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `GET /{chain}/api/v2/addresses/{address}`                    | Native balance and current native USD exchange rate                                       | One native asset row per chain                                       |
| `GET /{chain}/api/v2/addresses/{address}/tokens?type=ERC-20` | Paginated balances with nested token metadata and price                                   | ERC-20 portfolio rows                                                |
| `GET /{chain}/api/v2/tokens/{tokenAddress}`                  | Name, symbol, decimals, type, icon, rate, supply, holders, market cap, volume, reputation | Asset detail and cache hydration when the balance item is incomplete |

The ERC-20 balance response is structurally similar to:

```ts
interface BlockscoutAddressTokensPage {
  readonly items: ReadonlyArray<{
    readonly value: string;
    readonly token: BlockscoutTokenSummary;
  }>;
  readonly next_page_params: Readonly<Record<string, string | number>> | null;
}

interface BlockscoutTokenSummary {
  readonly address_hash: string;
  readonly name: string | null;
  readonly symbol: string | null;
  readonly decimals: string | null;
  readonly type: string;
  readonly icon_url: string | null;
  readonly exchange_rate: string | null;
  readonly holders_count: string | null;
  readonly reputation: "ok" | "scam" | null;
  readonly total_supply: string | null;
  readonly circulating_market_cap?: string | null;
  readonly volume_24h?: string | null;
}
```

Blockscout balance values are decimal integer strings. Namera's current public
portfolio DTO uses an exact `0x` integer for `rawBalance`; the EVM adapter must
convert without using JavaScript `number`, then format units with the validated
decimals. Prices remain nullable decimal strings.

The live API still returns questionable dust tokens with `reputation: "ok"`.
The default dashboard must:

- exclude `scam` assets;
- include only priced assets in total USD value and allocation charts;
- place unpriced assets in a separate, collapsed section;
- expose a user-controlled way to reveal hidden or low-confidence assets;
- never treat holder count or source verification alone as a trust guarantee.

### NFTs and collections

| Endpoint                                                      | Important upstream response                                | Namera use                |
| ------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------- |
| `GET /{chain}/api/v2/addresses/{address}/nft`                 | Paginated owned NFT instances with token/instance metadata | Future collectibles table |
| `GET /{chain}/api/v2/addresses/{address}/nft/collections`     | Owned NFTs grouped by collection                           | Future collection cards   |
| `GET /{chain}/api/v2/tokens/{token}/instances/{id}`           | Instance metadata, image, owner, and token context         | NFT detail drawer/page    |
| `GET /{chain}/api/v2/tokens/{token}/instances/{id}/transfers` | Instance transfer history                                  | NFT activity              |

NFTs must remain a separate endpoint and DTO from fungible assets. Images and
external metadata require stricter URL allowlisting, content limits, and proxy
handling than ERC-20 icons.

### Transactions and activity

| Endpoint                                                        | Important upstream response                                                          | Namera use                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `GET /{chain}/api/v2/addresses/{address}/transactions`          | Paginated status, value, timestamp, method, participants, decoded input, fee, result | Main activity feed                                   |
| `GET /{chain}/api/v2/addresses/{address}/token-transfers`       | ERC-20/ERC-721/ERC-1155 movements with token metadata                                | Asset activity and transfer rows                     |
| `GET /{chain}/api/v2/addresses/{address}/internal-transactions` | Internal native calls and outcomes                                                   | Expanded execution trace                             |
| `GET /{chain}/api/v2/transactions/{hash}`                       | Complete transaction detail                                                          | Execution detail enrichment                          |
| `GET /{chain}/api/v2/transactions/{hash}/summary`               | Human-readable action templates and variables                                        | “Sent 12.5 USDC”, swap, approval, and mint summaries |
| `GET /{chain}/api/v2/transactions/{hash}/token-transfers`       | Transaction-scoped asset movements                                                   | Execution effects                                    |
| `GET /{chain}/api/v2/transactions/{hash}/internal-transactions` | Transaction-scoped internal calls                                                    | Debug detail                                         |
| `GET /{chain}/api/v2/transactions/{hash}/logs`                  | Decoded/raw event logs                                                               | Advanced debug detail                                |
| `GET /{chain}/api/v2/transactions/{hash}/state-changes`         | Account/storage/balance changes where available                                      | Advanced execution effects                           |
| `GET /{chain}/api/v2/transactions/{hash}/raw-trace`             | Call trace                                                                           | Advanced developer diagnostics                       |

Transaction lists should remain compact. Fetch summary, state changes, logs,
and raw trace only for an opened execution detail page. Summary responses are a
presentation enhancement, not an authorization or accounting source of truth.
The Interpreter API is documented as in development, so Namera must retain a
deterministic fallback based on decoded method, native value, and token
transfers.

Every participant, implementation, and token address discovered in a response
is a candidate for batched metadata hydration. One transaction detail request
must collect unique addresses first and issue at most one metadata batch per
chain.

### Smart contracts and call policies

| Endpoint                                        | Important upstream response                                                                            | Namera use                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `GET /{chain}/api/v2/addresses/{address}`       | Contract name, verification, proxy type, current implementations, reputation                           | Contract pill and trust context                 |
| `GET /{chain}/api/v2/smart-contracts/{address}` | ABI, language, compiler, source-verification modes, proxy implementation, source and bytecode metadata | Function selector discovery and contract detail |
| `GET /{chain}/api/v2/tokens/{address}`          | Token standard and identity                                                                            | Token-specific call-policy presentation         |

The smart-contract response contains large and mutable fields such as ABI,
source code, creation/deployed bytecode, additional sources, compiler settings,
and constructor arguments. The address metadata row should retain only a
summary: contract name, verification state, proxy type, and current
implementation. Full ABI/source artifacts should use a separate bounded cache
when function-selector UI is implemented.

A call policy stores canonical chain ID, target address, and four-byte selector.
The display name and ABI signature are resolved presentation data. They must not
replace the byte-level policy values. Proxy upgrades can change the displayed
implementation and ABI without changing the target address.

### Account abstraction

| Endpoint                                                                        | Important upstream response                                                     | Namera use                           |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| `GET /{chain}/api/v2/proxy/account-abstraction/accounts/{address}`              | Smart-account factory, implementation, counters, and activity                   | Account implementation diagnostics   |
| `GET /{chain}/api/v2/proxy/account-abstraction/operations?sender={address}`     | Paginated UserOperations                                                        | Account and execution activity       |
| `GET /{chain}/api/v2/proxy/account-abstraction/operations/{userOpHash}`         | Sender, nonce, entry point, calls, gas, paymaster, bundler, transaction, status | Full Namera execution detail         |
| `GET /{chain}/api/v2/proxy/account-abstraction/operations/{userOpHash}/summary` | Human-readable UserOperation actions                                            | Execution summary                    |
| `GET /{chain}/api/v2/proxy/account-abstraction/paymasters/{address}`            | Paymaster statistics and operations                                             | Sponsorship diagnostics              |
| `GET /{chain}/api/v2/proxy/account-abstraction/bundlers/{address}`              | Bundler statistics and operations                                               | Submission diagnostics               |
| `GET /{chain}/api/v2/proxy/account-abstraction/factories/{address}`             | Factory statistics and accounts                                                 | Account creation diagnostics         |
| `GET /{chain}/api/v2/proxy/account-abstraction/status`                          | AA indexing availability                                                        | Feature health and graceful fallback |

Namera's database remains authoritative for its execution ID, actor, selected
session key, policy decision, billing reservation, sponsorship intent, and
lifecycle. Blockscout augments the confirmed onchain/UserOperation view; it
must not overwrite Namera execution state.

### Optional network context

| Endpoint                                                              | Important upstream response                            | Namera use                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| `GET /{chain}/api/v2/stats`                                           | Native price, network counters, gas and market context | Chain detail and provider health                    |
| `GET /{chain}/api/v2/addresses/{address}/coin-balance-history-by-day` | Recent daily native balance snapshots                  | Native-only balance chart                           |
| `GET /{chain}/api/v2/addresses/{address}/coin-balance-history`        | Native balance changes                                 | Native balance detail                               |
| `POST /{chain}/json-rpc`                                              | Limited Ethereum JSON-RPC methods                      | Not required while Alchemy is Namera's RPC provider |

Blockscout does not provide a ready historical USD portfolio series covering
all fungible assets. If Namera displays total portfolio history, persist a
separate periodic portfolio snapshot. Do not label native-only history as total
portfolio performance.

## Namera-normalized address metadata

### Namespace union

The JSONB payload is typed and normalized by Namera. It is not a raw Blockscout
response. Start with one discriminated EVM variant and extend the union when a
new namespace is implemented:

```ts
const AddressMetadataData = Schema.Union(
  [
    EvmAddressMetadataData,
    // SolanaAddressMetadataData in the future
  ],
  { mode: "oneOf" },
);
```

The initial logical shape is:

```ts
interface EvmAddressMetadataData {
  readonly schemaVersion: 1;
  readonly namespace: "eip155";
  readonly chainId: SupportedEvmChainId;
  readonly address: EthereumAddress;
  readonly kind: "eoa" | "contract" | "fungible-token" | "nft-contract" | "unknown";
  readonly identity: {
    readonly displayName: string | null;
    readonly description: string | null;
    readonly iconUrl: string | null;
  };
  readonly trust: {
    readonly reputation: "credible" | "neutral" | "suspicious" | "scam" | "unknown";
    readonly isScam: boolean;
    readonly isSourceVerified: boolean | null;
    readonly signals: ReadonlyArray<"blockscout" | "metadata-tag" | "token-market">;
  };
  readonly tags: ReadonlyArray<{
    readonly type: "name" | "category" | "protocol" | "information" | "classifier" | "note";
    readonly slug: string;
    readonly name: string;
  }>;
  readonly token: null | {
    readonly standard: "erc20" | "erc721" | "erc1155" | "other";
    readonly name: string | null;
    readonly symbol: string | null;
    readonly decimals: number | null;
    readonly logoUrl: string | null;
  };
  readonly contract: null | {
    readonly name: string | null;
    readonly proxyType: string | null;
    readonly implementationAddress: EthereumAddress | null;
    readonly implementationName: string | null;
  };
  readonly provenance: {
    readonly provider: "blockscout";
    readonly observedAt: string;
  };
}
```

The payload deliberately omits current price, balances, market cap, volume,
holder count, transaction counts, source code, bytecode, and full ABI. Those
values are volatile, large, or belong to other resources.

Normalization rules:

- Use CAIP-2 chain IDs such as `eip155:1`, never bare numeric IDs outside the
  provider adapter.
- Decode EVM addresses with `EthereumAddress`; use a canonical lowercase value
  for persistence lookup and a checksummed address in public presentation when
  the existing protocol transform requires it.
- Do not lowercase addresses for future namespaces whose address format is
  case-sensitive.
- Select `displayName` in order: credible name tag, token name, verified
  contract name, ENS/domain, protocol tag, then null.
- Select the icon from a validated HTTPS token/project icon. Reject `data:`,
  `javascript:`, local-network, and oversized URLs.
- Map provider tag types into the closed Namera vocabulary. Preserve unknown
  provider tags only in telemetry-free diagnostics, not the persisted payload.
- `isSourceVerified` means source matches deployed bytecode. It must be labeled
  “Verified contract,” not “Trusted” or “Safe.”
- A `credible-token`/equivalent tag can produce `credible`; `is_scam`, provider
  `scam`, or explicit malicious tags always produce `scam`. Conflicting signals
  resolve to the most restrictive result.
- Do not infer credibility from a non-null price, icon, holder count, or
  verified source alone.

### Database table

Use one provider-neutral table named `address_metadata`:

| Column          | PostgreSQL type | Required | Description                                            |
| --------------- | --------------- | -------- | ------------------------------------------------------ |
| `namespace`     | `text`          | Yes      | Namespace discriminator such as `eip155`               |
| `chain_id`      | `text`          | Yes      | Canonical CAIP-2 chain ID                              |
| `address`       | `text`          | Yes      | Namespace-normalized canonical address key             |
| `data`          | `jsonb`         | Yes      | `AddressMetadataData` decoded at repository boundaries |
| `observed_at`   | `timestamptz`   | Yes      | When the provider data was successfully observed       |
| `refresh_after` | `timestamptz`   | Yes      | Earliest normal refresh time                           |
| `created_at`    | `timestamptz`   | Yes      | Row creation time                                      |
| `updated_at`    | `timestamptz`   | Yes      | Last successful replacement time                       |

Constraints and indexes:

- Primary key: `(namespace, chain_id, address)`.
- Check that `data` is a JSON object.
- The repository decodes `data` with the protocol union and verifies that its
  namespace, chain ID, and address exactly match the key columns.
- B-tree index on `refresh_after` for bounded refresh claims.
- Trigram expression index on
  `lower(data #>> '{identity,displayName}')` for local autocomplete.
- Trigram expression index on `lower(data #>> '{token,symbol}')` for token
  symbol autocomplete.
- Enable PostgreSQL `pg_trgm` in the same migration before creating the two
  trigram indexes. If production policy does not allow the extension, replace
  fuzzy matching with measured prefix indexes rather than silently scanning the
  metadata table.
- Optional GIN index on `data` only after a measured query requires arbitrary
  tag containment; do not add it preemptively.

There is no synthetic ID, organization ID, or wallet foreign key. Metadata is
public chain data shared by every organization. The same hex address can mean
different things on different chains, so uniqueness on address alone is wrong.

### Address immutability and refresh policy

The canonical chain/address pair is immutable, but the metadata attached to it
is not. Token icons and descriptions change, source verification can appear
later, scam labels change, and proxy implementations upgrade without changing
the target address.

Use long-lived read-through caching with stale-while-revalidate:

| Result                                                          | Default `refresh_after` | Behavior                                                                   |
| --------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------- |
| EOA or stable non-proxy contract identity                       | 30 days                 | Return immediately; refresh asynchronously after expiry                    |
| Token identity                                                  | 30 days                 | Return immediately; refresh asynchronously after expiry                    |
| Proxy contract summary                                          | 24 hours                | Refresh implementation before presenting ABI-dependent methods             |
| Credibility/scam decision used only for display                 | 24 hours                | Stale display is allowed while background refresh runs                     |
| Credibility/scam decision used before a sensitive policy action | Maximum age 1 hour      | Refresh synchronously; failure does not silently convert unknown into safe |
| Address with no known metadata                                  | 24 hours                | Persist an `unknown` payload to prevent repeated misses                    |
| Provider failure                                                | No replacement          | Retain the last good row and retry with bounded backoff                    |

The row is replaced only after a complete provider response has been decoded
and normalized. Never overwrite a good row with a timeout, malformed response,
or partial batch omission.

## Provider and package boundaries

```text
protocol
  AddressMetadataData namespace union
  provider-neutral address, search, portfolio, activity, and contract DTOs

database
  address_metadata table
  AddressMetadataRepository exact/batch/search/upsert/claim-stale operations

evm
  Blockscout configuration and authenticated HTTP client
  raw response schemas
  chain ID/path mapping
  EVM normalization, pagination, and partial-failure handling
  address metadata, portfolio, activity, contract, and AA adapters

application
  authorization and scoped wallet loading
  cache read-through orchestration
  transactions that persist normalized cache rows
  provider-neutral namespace dispatch

api
  public normalized HttpApi contracts only

server
  BLOCKSCOUT_API_KEY Config and live Layer composition
  HTTP authorization, rate limits, cache headers, and transport mapping

dashboard
  address-pill resolver atoms/hooks
  asset/activity tables and policy autocomplete
  no Blockscout URL, key, or raw provider type
```

Blockscout-specific logic belongs in `packages/evm`, not application or server.
Application coordinates the metadata repository and the selected namespace
adapter. When another namespace is added, its adapter implements the same
provider-neutral operations instead of adding Blockscout or Solana switches to
HTTP handlers.

## Read flows

### Exact address pill

1. Consumer requests `(namespace, chainId, address)`.
2. Decode and normalize the key with the namespace protocol schema.
3. Read `address_metadata`.
4. Return a fresh row immediately.
5. Return a stale row immediately and enqueue/trigger a deduplicated refresh.
6. On a miss, fetch per-chain address detail plus metadata batch, normalize,
   upsert, and return it.
7. If Blockscout has no metadata, persist an `unknown` row and show a shortened
   address with the chain icon.

Expose a batch operation because transaction and table rendering commonly need
many pills. Never render one network request per React row.

### Policy target autocomplete

1. Require a namespace and chain selection before final selection.
2. Search indexed local `displayName`, token `symbol`, address, and normalized
   tags.
3. For a cache miss or sparse result, use multichain quick search on supported
   mainnets or per-chain search on testnets.
4. Normalize one candidate per chain/address and restrict results to the Namera
   supported-chain registry.
5. Hydrate only the top bounded candidates through address detail and metadata
   batch; upsert successful results.
6. Rank exact address, exact symbol, exact name, credible token/protocol, then
   prefix/fuzzy matches.
7. Render icon, name/symbol, chain, shortened address, contract verification,
   and an explicit warning for unknown/suspicious/scam results.
8. Persist only canonical policy values. Metadata remains replaceable display
   data.

### Portfolio

For each supported EVM chain, with concurrency bounded to the current Blockscout
plan's RPS limit:

1. Fetch address detail for native balance/rate.
2. Fetch every page of address ERC-20 balances.
3. Normalize exact balances and nullable prices into the existing
   `WalletAsset` DTO.
4. Collect token addresses and batch-read local metadata.
5. Hydrate missing/stale token identities in bounded metadata batches.
6. Return successful chains with typed per-chain partial failures.
7. Cache the assembled portfolio response outside `address_metadata` for a
   short 15–60 second freshness interval if latency or credit use becomes
   material.

Mainnet and testnet assets remain distinguishable. Testnet prices are normally
null and testnet holdings must never inflate a production USD total.

### Transaction or execution detail

1. Namera loads its own execution and authorization history from PostgreSQL.
2. Fetch Blockscout transaction and/or UserOperation detail by chain/hash.
3. Fetch token transfers for deterministic asset movements.
4. Fetch the human-readable summary opportunistically.
5. Collect unique sender, recipient, implementation, paymaster, bundler, and
   token addresses.
6. Resolve all pills through one cache batch and at most one metadata provider
   batch per chain.
7. Fetch logs/state changes/raw trace only when the user opens advanced detail.
8. Preserve Namera status when Blockscout is delayed or unavailable.

## Public normalized resources

The implementation should converge on four provider-neutral public concepts:

- `AddressDisplay`: canonical identity, kind, icon, tags, verification, and
  reputation for pills and selectors.
- `WalletAsset`: existing namespace union for exact balance, token identity,
  and nullable current USD quote.
- `ChainActivity`: normalized transaction, transfer, or namespace-specific
  operation summary with participant references.
- `ContractCallDescriptor`: canonical target, selector, signature, parameter
  schema, verification summary, and implementation reference.

Public DTOs may embed a compact `AddressDisplay` snapshot to prevent N+1 browser
lookups, while the database cache remains independently refreshable.

## Operational behavior

- Decode every upstream response with Effect Schema before normalization.
- Use bounded request concurrency at or below the configured Blockscout plan's
  RPS limit.
- Retry only timeouts, connection failures, `429`, and retryable `5xx` statuses
  with bounded exponential backoff and jitter.
- Respect `Retry-After` and Blockscout rate-limit headers.
- Use keyset pagination exactly as returned in `next_page_params`; public
  cursors remain opaque Namera values.
- Set provider timeouts independently for search, list, and detail calls.
- Record low-cardinality metrics by operation and result, never by address,
  chain hash, search text, or provider error message.
- Log provider operation, chain, status class, retry count, and latency; never
  log the API key or arbitrary response bodies.
- Return stale cached metadata when refresh fails. Portfolio/activity endpoints
  preserve typed partial failures when some chains fail.
- Add a circuit breaker only after real failure data shows it is needed.

## Security and presentation rules

- Treat Blockscout content as untrusted external input even when it describes a
  verified contract.
- Do not render provider HTML. Descriptions are plain text.
- Allow only validated HTTPS icon and project URLs; preferably proxy images
  through an image service before production.
- Do not persist or render `data:` URLs found in metadata `meta`.
- Cap tag counts, text lengths, URL lengths, and decoded metadata payload size.
- Never use metadata reputation as the sole backend authorization rule. Policy
  evaluation remains deterministic over canonical addresses, selectors, calls,
  and Namera-owned policy state.
- Display “Verified contract” and “Credible token” as distinct concepts.
- Scam and suspicious results require an explicit warning and should not be
  preselected by fuzzy search.

## Dashboard behavior

- Mainnet assets are the default for totals, allocation charts, filters, and
  rows. A single View options switch includes supported testnets.
- The portfolio summary is full width, omits passive coverage counters, and
  exposes partial provider failures through an informational tooltip.
- Allocation legends are replaced by value-and-share chart tooltips. The
  balance table is limited to asset, balance, price, and value.

## Pending

- Introduce shared dashboard address pills and policy-target autocomplete using
  the batch resolver rather than per-row requests.
- Add normalized transaction/activity resources and enrich execution details
  with compact address-display snapshots.
- Add account-abstraction enrichment and health-aware fallback from the
  provider endpoints cataloged above.
- Choose a production icon proxy/CDN policy and define a separate contract
  artifact cache before storing full ABIs.
- Add a bounded stale-metadata refresh worker and tune concurrency/cache policy
  from measured Blockscout credit consumption and cold-account latency.
- Add NFT ownership as a separate normalized API and dashboard surface.
- Define portfolio snapshot cadence and retention only when historical value is
  scheduled.
- Complete malformed-response, metadata-conflict, concurrent-cache, stale
  fallback, scam-filtering, partial-chain, authorization, and dashboard fan-out
  coverage for every consumed endpoint.
