# Supported EVM chains

The supported registry is code-owned in
[`packages/evm/src/chains/data.ts`](../../packages/evm/src/chains/data.ts). Every
entry binds a stable registry key, protocol CAIP-2 chain ID, family name, Viem
chain definition, and Alchemy network slug. The protocol schemas in
[`packages/protocol/src/evm/chains.ts`](../../packages/protocol/src/evm/chains.ts)
are the public validation boundary for the same set.

## Supported registry

Namera supports four mainnets and their corresponding testnets. All eight
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

The supported registry is consumed across the stack:

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

### Operational pause

Each registry row has a code-owned `operationsEnabled` flag (currently true for
all eight networks). Set it to false and rebuild/restart the server to pause new
execution/simulation preparation, session compilation, owner/session execution
signature acceptance, and message/typed-data signing. These adapter boundaries
return `EvmExecutionError` or `EvmSignatureError` with code `NETWORK_PAUSED`
before acquiring provider clients or signers. Unknown chains still return
`UnsupportedChainError`.
Session install and uninstall preparations use the same execution guard; a pause
therefore also pauses new owner-approved uninstall operations. Immediate API
grant revocation is independent of the network and remains available.

Do not remove a paused chain from protocol schemas or metadata. Already signed
durable submissions still submit/reconcile their immutable envelopes, and status,
receipts, verification, portfolio, and historical chain displays remain available.
This is an admission pause, not cancellation of previously authorized operations
or an onchain circuit breaker. Unit tests replace the registry lookup with a
paused row and verify the six preparation/signature boundaries fail before
provider/signer access. Dashboard session creation disables paused choices and
validates the network field; installation panels disable new approvals but keep
polling signed attempts. Policy editors retain paused choices for existing
restrictions. Both apps must rebuild for a code-owned flag change; stale browsers
remain subject to the server guards. Application execution, signature, session
creation and owner-approval errors preserve `NETWORK_PAUSED` as an HTTP 409
business error. The SDK returns it without automatic retries, local MCP exposes
it with `retryable: false`, and dashboard feedback explains the pause.
HTTP regressions cover admission without billing changes and signature acceptance
without attaching an execution envelope; provider enforcement is tested separately
at the adapter boundary.

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

Portfolio reads use the separate [Alchemy Portfolio adapter](portfolio.md),
including its network mapping, paging and pricing constraints.
