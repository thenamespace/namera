# Supported EVM chains

The launch registry is code-owned in
[`packages/evm/src/chains/data.ts`](../../packages/evm/src/chains/data.ts). Every
entry binds a stable registry key, protocol CAIP-2 chain ID, family name, Viem
chain definition, and Alchemy network slug. The protocol schemas in
[`packages/protocol/src/evm/chains.ts`](../../packages/protocol/src/evm/chains.ts)
are the public validation boundary for the same set.

Future candidates documented below are research data. They are intentionally
absent from runtime schemas, API validation, dashboard selectors, proxy routes,
and execution clients until promoted into the launch registry.

## Launch registry

Namera launches with four mainnets and their corresponding testnets. All eight
must support Alchemy Modular Account V2, its P-256 WebAuthn validation module,
EntryPoint `0.7`, Alchemy RPC, Rundler, and Bundler Sponsored Operations (BSO).

| Registry key       | CAIP-2 ID         | Family   | Environment | Native currency | Decimals | Alchemy slug   |
| ------------------ | ----------------- | -------- | ----------- | --------------- | -------: | -------------- |
| `ethereum-mainnet` | `eip155:1`        | Ethereum | Mainnet     | ETH             |       18 | `eth-mainnet`  |
| `ethereum-sepolia` | `eip155:11155111` | Ethereum | Testnet     | ETH             |       18 | `eth-sepolia`  |
| `base-mainnet`     | `eip155:8453`     | Base     | Mainnet     | ETH             |       18 | `base-mainnet` |
| `base-sepolia`     | `eip155:84532`    | Base     | Testnet     | ETH             |       18 | `base-sepolia` |
| `arbitrum-mainnet` | `eip155:42161`    | Arbitrum | Mainnet     | ETH             |       18 | `arb-mainnet`  |
| `arbitrum-sepolia` | `eip155:421614`   | Arbitrum | Testnet     | ETH             |       18 | `arb-sepolia`  |
| `optimism-mainnet` | `eip155:10`       | Optimism | Mainnet     | ETH             |       18 | `opt-mainnet`  |
| `optimism-sepolia` | `eip155:11155420` | Optimism | Testnet     | ETH             |       18 | `opt-sepolia`  |

Native-currency metadata and explorer URLs come from the imported Viem chain
definition. They must not be inferred from the family name in UI, policy, or
billing code.

## Runtime propagation

The launch registry is consumed across the stack:

- protocol DTOs reject any chain ID outside the eight launch networks;
- EVM account reconstruction, signing, simulation, and execution resolve the
  same registry before creating provider clients;
- the RPC proxy rejects unsupported numeric chain IDs before forwarding a
  request;
- dashboard creation flows, policy network selectors, chain displays, execution
  filters, and Wagmi transports derive their options from the EVM registry;
- chain icons and email assets are typed by the supported family union.

Registry construction derives a protocol-validated `SupportedEvmChainId` from
`eip155:<numeric-id>`. Helper maps provide constant lookup by numeric and CAIP-2
ID. Unknown inputs return `undefined`; adapter operations convert that absence
to `UnsupportedChainError` before making a provider call.

## Per-chain clients

`makeExecutionClients` lazily caches one client bundle by numeric chain ID:

| Client                       | Provider/use                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Viem `PublicClient`          | Alchemy HTTP for bytecode, blocks, simulation, calls, assets, and signature verification.                       |
| Regular Viem `BundlerClient` | Alchemy Rundler for EntryPoint `0.7` preparation, fee estimation, unsponsored submission, status, and receipts. |
| BSO Viem `BundlerClient`     | Submission-only Rundler transport carrying the configured `x-alchemy-policy-id` header.                         |
| Smart-account client factory | Reconstructs an Alchemy Modular Account V2 against the public and regular bundler clients.                      |

Provider configuration is read from redacted `EVM_ALCHEMY_API_KEY` and
`EVM_ALCHEMY_BSO_POLICY_ID` values at the server composition root. URLs,
credentials, and policy identifiers must not be logged.

## Future supported chains

The tables below are the future expansion pool verified on 2026-08-20 by exact
chain ID in the Alchemy Wallet APIs dashboard. They exclude the eight launch
networks.

Catalog source: [Alchemy Dashboard](https://dashboard.alchemy.com/).

Dashboard presence is a discovery gate, not production certification. A chain
must still pass Namera's capability suite before it is promoted. In particular,
Alchemy must implement the exact simulation RPCs Namera calls plus EntryPoint
`0.7` Rundler and BSO operations, and the Modular Account factory and P-256
validation module must exist at the expected addresses.

### Future mainnets

| Proposed registry key | Network         | CAIP-2 ID          | Native | Alchemy slug          |
| --------------------- | --------------- | ------------------ | ------ | --------------------- |
| `bnb-mainnet`         | BNB Smart Chain | `eip155:56`        | BNB    | `bnb-mainnet`         |
| `gnosis-mainnet`      | Gnosis          | `eip155:100`       | XDAI   | `gnosis-mainnet`      |
| `unichain-mainnet`    | Unichain        | `eip155:130`       | ETH    | `unichain-mainnet`    |
| `polygon-mainnet`     | Polygon         | `eip155:137`       | POL    | `polygon-mainnet`     |
| `monad-mainnet`       | Monad           | `eip155:143`       | MON    | `monad-mainnet`       |
| `sonic-mainnet`       | Sonic           | `eip155:146`       | S      | `sonic-mainnet`       |
| `opbnb-mainnet`       | opBNB           | `eip155:204`       | BNB    | `opbnb-mainnet`       |
| `world-chain-mainnet` | World Chain     | `eip155:480`       | ETH    | `worldchain-mainnet`  |
| `hyper-evm-mainnet`   | HyperEVM        | `eip155:999`       | HYPE   | `hyperliquid-mainnet` |
| `sei-mainnet`         | Sei             | `eip155:1329`      | SEI    | `sei-mainnet`         |
| `tempo-mainnet`       | Tempo           | `eip155:4217`      | USD    | `tempo-mainnet`       |
| `robinhood-mainnet`   | Robinhood Chain | `eip155:4663`      | ETH    | `robinhood-mainnet`   |
| `megaeth-mainnet`     | MegaETH         | `eip155:4326`      | ETH    | `megaeth-mainnet`     |
| `mantle-mainnet`      | Mantle          | `eip155:5000`      | MNT    | `mantle-mainnet`      |
| `mode-mainnet`        | Mode            | `eip155:34443`     | ETH    | `mode-mainnet`        |
| `celo-mainnet`        | Celo            | `eip155:42220`     | CELO   | `celo-mainnet`        |
| `avalanche-mainnet`   | Avalanche       | `eip155:43114`     | AVAX   | `avax-mainnet`        |
| `linea-mainnet`       | Linea           | `eip155:59144`     | ETH    | `linea-mainnet`       |
| `bob-mainnet`         | BOB             | `eip155:60808`     | ETH    | `bob-mainnet`         |
| `berachain-mainnet`   | Berachain       | `eip155:80094`     | BERA   | `berachain-mainnet`   |
| `blast-mainnet`       | Blast           | `eip155:81457`     | ETH    | `blast-mainnet`       |
| `scroll-mainnet`      | Scroll          | `eip155:534352`    | ETH    | `scroll-mainnet`      |
| `degen-mainnet`       | Degen           | `eip155:666666666` | DEGEN  | `degen-mainnet`       |

### Future testnets

| Proposed registry key | Network                 | CAIP-2 ID          | Native | Alchemy slug        |
| --------------------- | ----------------------- | ------------------ | ------ | ------------------- |
| `bnb-testnet`         | BNB Smart Chain Testnet | `eip155:97`        | tBNB   | `bnb-testnet`       |
| `sei-testnet`         | Sei Testnet             | `eip155:1328`      | SEI    | `sei-testnet`       |
| `unichain-sepolia`    | Unichain Sepolia        | `eip155:1301`      | ETH    | `unichain-sepolia`  |
| `mantle-sepolia`      | Mantle Sepolia          | `eip155:5003`      | MNT    | `mantle-sepolia`    |
| `monad-testnet`       | Monad Testnet           | `eip155:10143`     | MON    | `monad-testnet`     |
| `gnosis-chiado`       | Gnosis Chiado           | `eip155:10200`     | XDAI   | `gnosis-chiado`     |
| `tempo-moderato`      | Tempo Moderato          | `eip155:42431`     | USD    | `tempo-moderato`    |
| `avalanche-fuji`      | Avalanche Fuji          | `eip155:43113`     | AVAX   | `avax-fuji`         |
| `robinhood-testnet`   | Robinhood Chain Testnet | `eip155:46630`     | ETH    | `robinhood-testnet` |
| `linea-sepolia`       | Linea Sepolia           | `eip155:59141`     | ETH    | `linea-sepolia`     |
| `polygon-amoy`        | Polygon Amoy            | `eip155:80002`     | POL    | `polygon-amoy`      |
| `blast-sepolia`       | Blast Sepolia           | `eip155:168587773` | ETH    | `blast-sepolia`     |
| `arc-testnet`         | Arc Testnet             | `eip155:5042002`   | USDC   | `arc-testnet`       |

## Promotion checklist

Promoting a future candidate into the runtime registry requires one focused
change across the protocol, EVM adapter, frontend assets, and this document:

1. Confirm the chain still appears under the same chain ID in Alchemy Wallet
   APIs with Modular Account V2, Rundler, and BSO support.
2. Confirm Viem has accurate native-currency, RPC, testnet, and explorer
   metadata, or add a reviewed local chain definition.
3. Add the family name, stable registry key, and CAIP-2 literal to protocol.
4. Add the EVM registry row and Alchemy slug; add typed dashboard/email chain
   assets for a new family.
5. Probe Alchemy `eth_simulateV1`, `eth_createAccessList`, bytecode reads,
   message verification, and typed-data verification.
6. Probe Alchemy EntryPoint `0.7` Rundler fee/gas estimation and BSO submission,
   status, and receipt behavior, including the three required zero fields and
   policy header.
7. Test Modular Account V2 counterfactual address derivation, reconstruction,
   P-256 signing, simulation, sponsored execution, receipt normalization, and
   ERC-1271 verification on the exact chain.
8. Verify native-spend and gas-budget policy accounting with the chain's native
   decimals, asset-change output, and explorer transaction URL.
9. Classify the chain as production, preview, or testnet-only and add a bounded
   operational disable control before public release.

## Pending before production

- Run and retain the capability suite for all eight launch networks.
- Add automated provider health probes and a bounded per-chain disable control.
- Document mainnet sponsorship limits, exhaustion behavior, and provider
  fallback policy.
- Require explicit Modular Account V2 and BSO certification before promoting a
  future network.
