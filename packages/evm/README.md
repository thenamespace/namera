# @namera-ai/evm

EVM chain adapter infrastructure for Namera. It owns supported-chain metadata,
provider RPC URLs, internal Viem client factories, wallet-key WebAuthn owners,
smart-account construction for Kernel and Safe, execution, and EVM policy
evaluation behind one root `Evm` service.

## Structure

- `src/chains/` — supported Viem chains, CAIP-2 metadata, and lookups.
- `src/clients/` — internal cached Alchemy public and Pimlico-native clients;
  these are deliberately absent from the package root exports. Account-scoped
  smart clients use Pimlico sponsorship and Pimlico's fast UserOperation gas
  price while preparing operations.
- `src/accounts/` — shared smart-account creation, reconstruction, and
  wallet-key owner construction.
- `src/execution/` — EVM preparation, signing, submission, and normalized
  receipt operations exposed through `evm.execution`. Preparation combines
  ERC-4337 gas simulation with `simulateCalls` asset-change and native-transfer
  tracing, then exposes only the bounded protocol context to policies.
- `src/policy/` — exhaustive EVM policy registry and lifecycle service;
  individual handlers live in `src/policy/policies/`.
- `src/signatures/` — provider signature conversion for EVM validators.
- `src/signing/` — smart-account message and EIP-712 signing exposed as
  `evm.sign`; raw digest signing is not supported.
- `src/config.ts` — redacted provider credentials.
- `src/layer.ts` — root `Evm` service and live layer.

## Adding EVM behavior

1. Put chain metadata and CAIP-2 lookup changes in `chains`; never scatter chain
   IDs or provider slugs through operations.
   Add its stable network key, presentation name, and CAIP-2 literal to the
   protocol chain schemas in the same change.
2. Keep Viem client factories as plain internal helpers. Create clients inside
   the operation using `EvmConfig`; do not expose their large generic types from
   the public service.
3. Add account implementations under `accounts` and route them through the
   discriminated `evm.createAccount` input so the implementation-specific result
   remains inferred.
4. Convert provider, account, and signing failures into protocol errors at the
   adapter boundary. Keep key creation and persistence in application workflows,
   not this package.
5. Put EVM-specific transaction normalization, simulation, execution, and policy
   evaluation here. The application package selects the wallet/grants and
   coordinates persistence; the server only adapts HTTP.

Provider ECDSA signatures are DER encoded. Use
`derSignatureToEvmSignature` to produce the validator representation:
P-256 validators receive fixed-width `r || s`, while secp256k1 validators
receive `r || s || v` after recovery parity is matched against the stored public
key. The secp256k1 variant requires the exact digest that the provider signed.

## Environment

| Variable              | Required | Purpose                        |
| --------------------- | -------- | ------------------------------ |
| `EVM_ALCHEMY_API_KEY` | Yes      | Alchemy execution RPC key.     |
| `EVM_PIMLICO_API_KEY` | Yes      | Pimlico bundler/paymaster key. |

## Usage

```ts
import { Effect } from "effect";
import { Evm } from "@namera-ai/evm";

const program = Effect.gen(function* () {
  const evm = yield* Evm;
  return yield* evm.getRpcUrl(1, "public");
}).pipe(Effect.provide(Evm.layer));
```

`getRpcUrl` supports `public`, `bundler`, and `paymaster` endpoints. Full Viem
clients are created inside wallet and execution operations without exposing
their generic types to package consumers.

`evm.execution` owns the complete EntryPoint 0.7 adapter lifecycle. `prepare`
reconstructs the stored smart account and returns a serializable stub-signed
UserOperation plus its normalized intent context. `sign` reconstructs and
verifies the account again, signs the exact prepared operation, and computes
its deterministic hash. `submit` verifies that hash before and after sending
the exact signed payload to Pimlico. `getReceipt` and `waitForReceipt` normalize
confirmed receipts and return `Option.none` while a receipt is unavailable or a
bounded wait expires. `getStatus` uses Pimlico's lifecycle status method so
reconciliation can distinguish pending operations from definitive failure.
Pimlico has no dedicated bulk receipt action, so background processing batches
database claims and performs bounded concurrent lookups across their chains.

`evm.policy` evaluates one complete decoded EVM policy set and owns its
`reserve`, `settle`, and `release` lifecycle. `evm.time-window` is stateless and
uses the prepared block timestamp with an inclusive start and exclusive
expiration. `evm.native-spend-limit` tracks spent and in-flight native value per
CAIP-2 chain so concurrent executions cannot consume the same allowance. Each
handler owns the schemas used to decode persisted state and reservations.

`evm.sign` reconstructs the stored Kernel or Safe account on the requested
supported chain and delegates either UTF-8 message signing or EIP-712 typed-data
signing to the smart account. Callers provide the provider-neutral account
reconstruction input; database access and grant selection remain in
`application`.

Preparation records the standardized `eth_estimateUserOperationGas` result in
the policy context. This verifies EntryPoint validation and execution before
signing; the adapter does not claim provider-specific token balance changes.

`Evm.testLayer` supplies a deterministic adapter for server boundary tests.
Use `Evm.testLayerWith({ execution: { ... } })` to override only the behavior a
test needs while retaining the real policy registry and the rest of the
deterministic execution lifecycle.
