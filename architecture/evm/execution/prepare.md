# Prepare and simulate

Preparation turns decoded calls and stored smart-account data into an unsigned EntryPoint 0.7 UserOperation plus a policy context anchored to a concrete block.

## Inputs

- supported CAIP-2 chain ID;
- reconstructed Kernel or Safe account data and owner account;
- ordered calls containing destination, native value, and calldata.

## Pipeline

```mermaid
flowchart TD
  Input[chain, account, calls] --> Chain{Supported CAIP-2 chain?}
  Chain -->|No| Unsupported[UnsupportedChainError]
  Chain -->|Yes| Reconstruct[Reconstruct smart account and verify address]
  Reconstruct --> Prepare[SmartAccountClient.prepareUserOperation]
  Prepare --> Estimate[Pimlico estimateUserOperationGas]
  Estimate --> Calls[Viem simulateCalls]
  Calls --> Block{Latest block has hash and number?}
  Block -->|No| Failure[PREPARATION_FAILED]
  Block -->|Yes| Normalize[Normalize/encode UserOperation and context]
  Normalize --> Prepared[EvmPreparedExecution v1]
```

`prepareUserOperation` failures classified by Viem as `UserOperationExecutionError` map to `SIMULATION_FAILED`; other construction failures map to `PREPARATION_FAILED`. Pimlico estimation or call simulation failure maps to `SIMULATION_FAILED`.

## Two simulations

| Simulation                                     | Purpose                                                          | Context fields                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `eth_estimateUserOperationGas` through Pimlico | Validate ERC-4337 envelope and estimate EntryPoint/paymaster gas | call, verification, pre-verification, paymaster verification/post-op gas  |
| `viem.simulateCalls` through public RPC        | Execute exact account calls and trace user-visible effects       | per-call status/return/gas, asset changes, native transfers, block anchor |

Both are required: EntryPoint gas estimation does not provide the same asset-transfer context, while raw call simulation does not validate the complete ERC-4337 envelope.

## Call normalization

For auxiliary `simulateCalls`, empty calldata is omitted rather than sent as `data: "0x"`; Viem otherwise attempts an access-list asset-selector path that can produce provider gas errors. Non-empty calldata remains unchanged.

Native transfers are normalized from provider trace logs emitted at `0xeeee…eeee` with the ERC-20-style `Transfer(address,address,uint256)` selector. Each record includes call index, from, to, and decimal-string value. Token asset changes contain address, bounded symbol (≤64 when valid), optional valid decimals (0–255), and pre/post/diff values.

## Prepared context

The version-1 `EvmIntentContext` includes:

- namespace, chain ID, and reconstructed account address;
- block number, hash, and timestamp;
- ordered calls with bigint values normalized for schema encoding;
- nonce, complete gas envelope, fee caps, and paymaster;
- both simulation sources and normalized results.

Policies consume this context. Period windows use the simulated block timestamp rather than server wall-clock time; gas budgets use the pessimistic prepared gas/fee envelope; native-spend limits inspect exact call values.

## Integrity boundary

`EvmPreparedExecution` includes serialized UserOperation and redundant normalized context. The sign phase intentionally compares them before producing a signature, protecting against accidental or malicious mutation between policy evaluation and signing.

## Pending before production

- Validate `simulateCalls` and asset tracing support on every advertised chain/provider tier.
- Add fixtures for malformed token metadata and native-transfer trace normalization.
- Define behavior when asset tracing is unavailable but ERC-4337 simulation succeeds.
