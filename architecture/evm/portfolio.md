# Fungible portfolio

Namera uses [Alchemy Portfolio](https://www.alchemy.com/docs/data/portfolio-apis/portfolio-api-endpoints/portfolio-api-endpoints/get-tokens-by-address)
for native and ERC-20 balances, token metadata, and current USD prices. The EVM
adapter owns all provider shapes and uses `EVM_ALCHEMY_API_KEY`.

## Flow and limits

`GET /wallets/:walletId/portfolio` checks scoped wallet access on every request.
`POST /portfolios/assets/query` queries an explicit EVM address. Application
assembles summaries before offset pagination. Both return provider-neutral assets,
exact decimal USD values, and per-chain partial failures. There are no persistent
portfolio writes, audit events, or background refresh jobs.

The adapter requests one address and up to four networks per call, with two concurrent
batches. Eight selected networks therefore need two initial calls; additional pages
are fetched independently within each batch. This stays within Alchemy's per-request limits.
It requests metadata, prices, native tokens, and ERC-20 tokens, follows all page
keys, and deduplicates by chain and contract. Repeated cursors, more than 100 pages,
invalid balance/identity fields, and a 30-second batch timeout fail that batch
instead of presenting an incomplete total as complete. HTTP-200 partial errors
are tracked per network across every page, excluding that network's incomplete balances
while retaining successful networks from the same batch. Unsupported networks, including unavailable testnets, appear in
`partialFailures`; total provider failure returns `PORTFOLIO_UNAVAILABLE`.

Missing token metadata does not remove a balance. Unknown decimals produce a null
formatted balance; missing/invalid USD prices produce null value. Native token
identity falls back to the configured chain currency. Calculations use exact
BigDecimal arithmetic; floating-point conversion is confined to chart/display
values. Token symbols do not establish asset identity or trust. Alchemy does not
supply the former source-verification and reputation signals.

Portfolio API access and rate limits depend on the Alchemy account. Each provider
page consumes provider capacity; caching reduces repeated calls. The API provides
current valuations, not historical portfolio performance. Provider URLs include
the key, so outbound traces and raw provider error export are disabled for this
adapter. Only HTTPS token images are passed to the dashboard.

## Account caching and refresh

Application caches complete snapshots per normalized address and selected chain
set, with a five-minute TTL and a 500-entry bound per server process. Concurrent
normal reads of a key share lookup work; errors are not cached. Separate server
replicas have independent caches. Pagination reads the complete cached snapshot.
An explicit `refresh=true` on the first page refreshes the provider snapshot;
subsequent pages must omit refresh. Authorization is never cached.

The dashboard retains each account query for five minutes while idle, loads all
API pages, and uses the result for both table and charts. The tertiary refresh
icon fetches a new snapshot, then invalidates that account's query so table and
charts update together. Refresh failures retain the displayed snapshot and show
an error. All supported mainnets and testnets are included in totals, charts,
assets, and unavailable-network counts by default. The table's Chain filter lists
every supported network in Mainnets/Testnets groups, including zero-balance networks;
there is no separate view-options control. Table filters do not change the portfolio summary.
Unpriced assets remain visible but do not
contribute to USD allocation. Asset slices are identified by chain and contract,
with small holdings grouped into Other; chain slices use the same asset values.

## Persistence

Portfolio snapshots live in bounded process memory. Balances and token metadata
have no database table. Migration history remains intact; fresh databases load
`pg_trgm` when replaying the migration chain.

## Verification

Provider integration tests cover pagination, exact valuation, missing metadata,
partial failures, repeated cursors, and sanitized provider failures. Account
cache tests cover reuse and explicit refresh. Existing wallet authorization tests
continue to exercise scoped reads.
