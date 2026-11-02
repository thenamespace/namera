# Portfolio data

Portfolio reads query Alchemy for an EVM address across supported chains. They do
not execute transactions or maintain a local balance ledger.

The EVM adapter owns provider pagination, network identifiers and decoding. It
returns exact raw/formatted balances, nullable metadata and prices, decimal USD
values and per-chain failures. An unpriced asset is not a zero balance.

Application caches complete successful snapshots for five minutes, with a maximum
of 500 keys. Failed requests have no cache lifetime. The cache key normalizes the
address and sorts/deduplicates requested chains; it excludes page size and cursor.
An explicit refresh applies only to the first page.

Application sorts by USD value and pages the snapshot. Summary counts and chain
totals cover the full snapshot, not only the returned page. Unpriced assets count
separately and contribute zero to the displayed sum. `partialFailures` tells the
caller which chains could not be read. Cache expiry or a refresh can change later
pages; the cursor is an offset, not a durable historical snapshot identifier.

## Networks

The registry includes Ethereum, Base, Arbitrum and Optimism mainnets and their
Sepolia testnets, plus Arc mainnet and testnet. `operationsEnabled` controls new transaction/signature admission
without removing chain identity needed for recovery of existing operations.
Portfolio availability also depends on Alchemy Portfolio access for the server key.

Arc indexer requests run separately from other networks and each other. The
adapter reads native USDC through `eth_getBalance`, preserves its 18-decimal
precision, and removes the duplicate six-decimal ERC-20 representation before
application totals and pagination. Prices remain provider-supplied and nullable.
If indexing fails, a known nonzero native balance can still be returned with a
partial failure; it is not a complete or cacheable snapshot. If native RPC fails,
an available indexed native balance is used; an ERC-20-only balance stays partial.
Verified zero balances are omitted without inventing assets.

## Code

- [Portfolio application](../../packages/application/src/data/portfolio.ts)
- [Provider adapter](../../packages/evm/src/portfolio/alchemy.ts)
- [Chain registry](../../packages/evm/src/chains/data.ts)
