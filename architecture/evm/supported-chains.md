# Supported EVM chains

The chain registry is code-owned in [`packages/evm/src/chains/data.ts`](../../packages/evm/src/chains/data.ts). Every entry binds a human registry key, protocol CAIP-2 chain ID, family name, Viem chain definition, and Alchemy network slug.

## Registry

| Registry key        | CAIP-2 ID         | Family    | Native currency | Decimals | Alchemy slug          |
| ------------------- | ----------------- | --------- | --------------- | -------: | --------------------- |
| `arbitrum-mainnet`  | `eip155:42161`    | Arbitrum  | ETH             |       18 | `arb-mainnet`         |
| `arbitrum-sepolia`  | `eip155:421614`   | Arbitrum  | ETH             |       18 | `arb-sepolia`         |
| `arc-testnet`       | `eip155:5042002`  | Arc       | USDC            |       18 | `arc-testnet`         |
| `avalanche-fuji`    | `eip155:43113`    | Avalanche | AVAX            |       18 | `avax-fuji`           |
| `avalanche-mainnet` | `eip155:43114`    | Avalanche | AVAX            |       18 | `avax-mainnet`        |
| `base-mainnet`      | `eip155:8453`     | Base      | ETH             |       18 | `base-mainnet`        |
| `base-sepolia`      | `eip155:84532`    | Base      | ETH             |       18 | `base-sepolia`        |
| `celo-mainnet`      | `eip155:42220`    | Celo      | CELO            |       18 | `celo-mainnet`        |
| `ethereum-mainnet`  | `eip155:1`        | Ethereum  | ETH             |       18 | `eth-mainnet`         |
| `ethereum-sepolia`  | `eip155:11155111` | Ethereum  | ETH             |       18 | `eth-sepolia`         |
| `hyper-evm-mainnet` | `eip155:999`      | HyperEVM  | HYPE            |       18 | `hyperliquid-mainnet` |
| `megaeth-mainnet`   | `eip155:4326`     | MegaETH   | ETH             |       18 | `megaeth-mainnet`     |
| `megaeth-testnet`   | `eip155:6343`     | MegaETH   | ETH             |       18 | `megaeth-testnet`     |
| `monad-mainnet`     | `eip155:143`      | Monad     | MON             |       18 | `monad-mainnet`       |
| `monad-testnet`     | `eip155:10143`    | Monad     | MON             |       18 | `monad-testnet`       |
| `optimism-mainnet`  | `eip155:10`       | Optimism  | ETH             |       18 | `opt-mainnet`         |
| `optimism-sepolia`  | `eip155:11155420` | Optimism  | ETH             |       18 | `opt-sepolia`         |
| `polygon-amoy`      | `eip155:80002`    | Polygon   | POL             |       18 | `polygon-amoy`        |
| `polygon-mainnet`   | `eip155:137`      | Polygon   | POL             |       18 | `polygon-mainnet`     |
| `scroll-mainnet`    | `eip155:534352`   | Scroll    | ETH             |       18 | `scroll-mainnet`      |
| `scroll-sepolia`    | `eip155:534351`   | Scroll    | ETH             |       18 | `scroll-sepolia`      |
| `tempo-mainnet`     | `eip155:4217`     | Tempo     | USD             |        6 | `tempo-mainnet`       |
| `tempo-moderato`    | `eip155:42431`    | Tempo     | USD             |        6 | `tempo-moderato`      |
| `unichain-mainnet`  | `eip155:130`      | Unichain  | ETH             |       18 | `unichain-mainnet`    |
| `unichain-sepolia`  | `eip155:1301`     | Unichain  | ETH             |       18 | `unichain-sepolia`    |

Native currency metadata comes from the imported Viem chain definition. It must not be inferred from family name in UI or policy code.

## Lookup behavior

Registry construction derives a protocol-validated `SupportedEvmChainId` from `eip155:<numeric-id>`. Helper maps provide constant lookup by numeric chain ID and CAIP-2 ID. Unknown inputs return `undefined`; adapter operations convert that to `UnsupportedChainError` before any provider call.

## Per-chain clients

`makeExecutionClients` lazily caches one client bundle by numeric chain ID:

| Client                       | Provider/use                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| Viem `PublicClient`          | Alchemy HTTP for code, blocks, simulation, calls, assets, and signature verification.                  |
| Pimlico client               | ERC-4337 EntryPoint 0.7 gas estimation, submission, status, receipt, and paymaster.                    |
| Smart-account client factory | Binds a reconstructed account to public client, Pimlico bundler/paymaster, and Pimlico fast gas price. |

Provider credentials are read from redacted `EVM_ALCHEMY_API_KEY` and `EVM_PIMLICO_API_KEY` configuration at the server composition root. URLs and secrets must not be logged.

## Adding a chain

1. Confirm Viem has an accurate chain definition or add a reviewed local definition.
2. Add protocol supported-chain key/CAIP-2 literals and UI metadata.
3. Add the registry row and valid Alchemy slug.
4. Confirm Pimlico supports EntryPoint 0.7, paymaster, gas price, submission, and receipt APIs for the chain.
5. Run account reconstruction, counterfactual address, `simulateCalls`, user-operation estimation, sponsored submission, receipt, message signing, and typed-data verification tests.
6. Verify native currency symbol/decimals and explorer transaction URL.
7. Add policy/UI chain selectors and document its support tier.

Adding a registry row without provider capability testing advertises a broken chain and is not sufficient.

## Pending before production

- Classify each chain as production-supported, preview, or testnet-only.
- Add automated provider capability probes and a bounded chain-disable control.
- Verify Arc's native-currency metadata against the production provider definition before charging/displaying value.
- Document mainnet gas sponsorship limits and failure behavior.
