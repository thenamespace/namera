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
must support Kernel `0.3.3`, Safe `1.4.1`, EntryPoint `0.7`, Alchemy RPC, and
Pimlico bundler/paymaster operations.

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

| Client                       | Provider/use                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Viem `PublicClient`          | Alchemy HTTP for bytecode, blocks, simulation, calls, assets, and signature verification.               |
| Pimlico client               | ERC-4337 EntryPoint `0.7` estimation, submission, status, receipt, fast gas price, and sponsorship.     |
| Smart-account client factory | Reconstructs a Kernel `0.3.3` or Safe `1.4.1` account against the public and bundler/paymaster clients. |

Provider credentials are read from redacted `EVM_ALCHEMY_API_KEY` and
`EVM_PIMLICO_API_KEY` configuration at the server composition root. URLs and
secrets must not be logged.

## Future supported chains

The tables below are the future expansion pool verified on 2026-08-20 by exact
chain ID across the Alchemy, Pimlico, and ZeroDev dashboard network catalogs.
They exclude the eight launch networks. `Yes / Yes / Yes` in the provider
column means that the same chain ID appeared in Alchemy RPC, Pimlico
bundler/paymaster, and ZeroDev Kernel network settings respectively.

Catalog sources: [Alchemy Dashboard](https://dashboard.alchemy.com/),
[Pimlico Dashboard](https://dashboard.pimlico.io/),
[ZeroDev Dashboard](https://dashboard.zerodev.app/), and the official Safe
[`1.4.1` deployment registry](https://github.com/safe-global/safe-deployments/blob/main/src/assets/v1.4.1/safe.json).

Dashboard presence is a discovery gate, not production certification. A chain
must still pass Namera's capability suite before it is promoted. In particular,
Alchemy must implement the exact simulation RPCs Namera calls, Pimlico must
support the required EntryPoint `0.7` and paymaster operations, and the selected
Kernel/Safe contracts must exist at the expected addresses.

### Future mainnets

| Proposed registry key | Network         | CAIP-2 ID          | Native | Alchemy slug          | Alchemy / Pimlico / ZeroDev | Kernel `0.3.3` | Safe `1.4.1` |
| --------------------- | --------------- | ------------------ | ------ | --------------------- | --------------------------- | -------------- | ------------ |
| `bnb-mainnet`         | BNB Smart Chain | `eip155:56`        | BNB    | `bnb-mainnet`         | Yes / Yes / Yes             | Eligible       | Eligible     |
| `gnosis-mainnet`      | Gnosis          | `eip155:100`       | XDAI   | `gnosis-mainnet`      | Yes / Yes / Yes             | Eligible       | Eligible     |
| `unichain-mainnet`    | Unichain        | `eip155:130`       | ETH    | `unichain-mainnet`    | Yes / Yes / Yes             | Eligible       | Eligible     |
| `polygon-mainnet`     | Polygon         | `eip155:137`       | POL    | `polygon-mainnet`     | Yes / Yes / Yes             | Eligible       | Eligible     |
| `monad-mainnet`       | Monad           | `eip155:143`       | MON    | `monad-mainnet`       | Yes / Yes / Yes             | Eligible       | Eligible     |
| `sonic-mainnet`       | Sonic           | `eip155:146`       | S      | `sonic-mainnet`       | Yes / Yes / Yes             | Eligible       | Eligible     |
| `opbnb-mainnet`       | opBNB           | `eip155:204`       | BNB    | `opbnb-mainnet`       | Yes / Yes / Yes             | Eligible       | Eligible     |
| `world-chain-mainnet` | World Chain     | `eip155:480`       | ETH    | `worldchain-mainnet`  | Yes / Yes / Yes             | Eligible       | Eligible     |
| `hyper-evm-mainnet`   | HyperEVM        | `eip155:999`       | HYPE   | `hyperliquid-mainnet` | Yes / Yes / Yes             | Eligible       | Eligible     |
| `sei-mainnet`         | Sei             | `eip155:1329`      | SEI    | `sei-mainnet`         | Yes / Yes / Yes             | Eligible       | Eligible     |
| `tempo-mainnet`       | Tempo           | `eip155:4217`      | USD    | `tempo-mainnet`       | Yes / Yes / Yes             | Eligible       | Eligible     |
| `robinhood-mainnet`   | Robinhood Chain | `eip155:4663`      | ETH    | `robinhood-mainnet`   | Yes / Yes / Yes             | Eligible       | Eligible     |
| `megaeth-mainnet`     | MegaETH         | `eip155:4326`      | ETH    | `megaeth-mainnet`     | Yes / Yes / Yes             | Eligible       | Eligible     |
| `mantle-mainnet`      | Mantle          | `eip155:5000`      | MNT    | `mantle-mainnet`      | Yes / Yes / Yes             | Eligible       | Eligible     |
| `mode-mainnet`        | Mode            | `eip155:34443`     | ETH    | `mode-mainnet`        | Yes / Yes / Yes             | Eligible       | Eligible     |
| `celo-mainnet`        | Celo            | `eip155:42220`     | CELO   | `celo-mainnet`        | Yes / Yes / Yes             | Eligible       | Eligible     |
| `avalanche-mainnet`   | Avalanche       | `eip155:43114`     | AVAX   | `avax-mainnet`        | Yes / Yes / Yes             | Eligible       | Eligible     |
| `linea-mainnet`       | Linea           | `eip155:59144`     | ETH    | `linea-mainnet`       | Yes / Yes / Yes             | Eligible       | Eligible     |
| `bob-mainnet`         | BOB             | `eip155:60808`     | ETH    | `bob-mainnet`         | Yes / Yes / Yes             | Eligible       | Eligible     |
| `berachain-mainnet`   | Berachain       | `eip155:80094`     | BERA   | `berachain-mainnet`   | Yes / Yes / Yes             | Eligible       | Eligible     |
| `blast-mainnet`       | Blast           | `eip155:81457`     | ETH    | `blast-mainnet`       | Yes / Yes / Yes             | Eligible       | Eligible     |
| `scroll-mainnet`      | Scroll          | `eip155:534352`    | ETH    | `scroll-mainnet`      | Yes / Yes / Yes             | Eligible       | Eligible     |
| `degen-mainnet`       | Degen           | `eip155:666666666` | DEGEN  | `degen-mainnet`       | Yes / Yes / Yes             | Eligible       | Eligible     |

### Future testnets

| Proposed registry key | Network                 | CAIP-2 ID          | Native | Alchemy slug        | Alchemy / Pimlico / ZeroDev | Kernel `0.3.3` | Safe `1.4.1`    |
| --------------------- | ----------------------- | ------------------ | ------ | ------------------- | --------------------------- | -------------- | --------------- |
| `bnb-testnet`         | BNB Smart Chain Testnet | `eip155:97`        | tBNB   | `bnb-testnet`       | Yes / Yes / Yes             | Eligible       | Eligible        |
| `sei-testnet`         | Sei Testnet             | `eip155:1328`      | SEI    | `sei-testnet`       | Yes / Yes / Yes             | Eligible       | Eligible        |
| `unichain-sepolia`    | Unichain Sepolia        | `eip155:1301`      | ETH    | `unichain-sepolia`  | Yes / Yes / Yes             | Eligible       | Eligible        |
| `mantle-sepolia`      | Mantle Sepolia          | `eip155:5003`      | MNT    | `mantle-sepolia`    | Yes / Yes / Yes             | Eligible       | Eligible        |
| `monad-testnet`       | Monad Testnet           | `eip155:10143`     | MON    | `monad-testnet`     | Yes / Yes / Yes             | Eligible       | Eligible        |
| `gnosis-chiado`       | Gnosis Chiado           | `eip155:10200`     | XDAI   | `gnosis-chiado`     | Yes / Yes / Yes             | Eligible       | **Unavailable** |
| `tempo-moderato`      | Tempo Moderato          | `eip155:42431`     | USD    | `tempo-moderato`    | Yes / Yes / Yes             | Eligible       | Eligible        |
| `avalanche-fuji`      | Avalanche Fuji          | `eip155:43113`     | AVAX   | `avax-fuji`         | Yes / Yes / Yes             | Eligible       | Eligible        |
| `robinhood-testnet`   | Robinhood Chain Testnet | `eip155:46630`     | ETH    | `robinhood-testnet` | Yes / Yes / Yes             | Eligible       | Eligible        |
| `linea-sepolia`       | Linea Sepolia           | `eip155:59141`     | ETH    | `linea-sepolia`     | Yes / Yes / Yes             | Eligible       | Eligible        |
| `polygon-amoy`        | Polygon Amoy            | `eip155:80002`     | POL    | `polygon-amoy`      | Yes / Yes / Yes             | Eligible       | Eligible        |
| `blast-sepolia`       | Blast Sepolia           | `eip155:168587773` | ETH    | `blast-sepolia`     | Yes / Yes / Yes             | Eligible       | Eligible        |
| `arc-testnet`         | Arc Testnet             | `eip155:5042002`   | USDC   | `arc-testnet`       | Yes / Yes / Yes             | Eligible       | Eligible        |

Gnosis Chiado remains a Kernel-only candidate because Safe `1.4.1` does not
list chain ID `10200` in its released deployment registry. It must not be added
to a product surface that promises both account implementations unless Safe is
upgraded, deployed, or explicitly disabled for that network.

## Promotion checklist

Promoting a future candidate into the runtime registry requires one focused
change across the protocol, EVM adapter, frontend assets, and this document:

1. Confirm the chain still appears under the same chain ID in Alchemy, Pimlico,
   and ZeroDev, and confirm the required Safe version when Safe is offered.
2. Confirm Viem has accurate native-currency, RPC, testnet, and explorer
   metadata, or add a reviewed local chain definition.
3. Add the family name, stable registry key, and CAIP-2 literal to protocol.
4. Add the EVM registry row and Alchemy slug; add typed dashboard/email chain
   assets for a new family.
5. Probe Alchemy `eth_simulateV1`, `eth_createAccessList`, bytecode reads,
   message verification, and typed-data verification.
6. Probe Pimlico EntryPoint `0.7` gas estimation, fast gas price, sponsorship,
   submission, status, and receipt behavior.
7. Test Kernel and Safe counterfactual address derivation, reconstruction,
   signing, simulation, sponsored execution, receipt normalization, and
   ERC-1271 verification on the exact chain.
8. Verify native-spend and gas-budget policy accounting with the chain's native
   decimals, asset-change output, and explorer transaction URL.
9. Classify the chain as production, preview, or testnet-only and add a bounded
   operational disable control before public release.

## Pending before production

- Run and retain the capability suite for all eight launch networks and both
  account implementations.
- Add automated provider health probes and a bounded per-chain disable control.
- Document mainnet sponsorship limits, exhaustion behavior, and provider
  fallback policy.
- Decide whether launch support requires both Kernel and Safe on every future
  network or permits explicitly labeled implementation-specific chains.
