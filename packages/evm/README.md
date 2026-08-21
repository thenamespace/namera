# @namera-ai/evm

EVM chain adapter infrastructure for Namera. It owns supported-chain metadata,
provider RPC URLs, internal Viem client factories, wallet-key WebAuthn owners,
smart-account construction for Kernel and Safe, execution, and EVM policy
evaluation behind one root `Evm` service.

See the [EVM architecture hub](../../architecture/evm/README.md) for supported
chains, Kernel/Safe reconstruction, preparation, signing/submission,
reconciliation, signatures, and policy internals. Cross-package product flows
remain under [operations](../../architecture/operations/executions.md).

## Structure

- `src/chains/` — supported Viem chains, CAIP-2 metadata, and lookups.
- `src/clients/` — internal cached Alchemy public, Rundler, and Gas Manager clients;
  these are deliberately absent from the package root exports. Account-scoped
  smart clients use Alchemy Gas Manager sponsorship and Rundler fee estimates
  while preparing operations.
- `src/accounts/` — shared smart-account creation, reconstruction, and
  wallet-key owner construction.
- `src/execution/` — EVM preparation, signing, submission, and normalized
  receipt operations exposed through `evm.execution`. Preparation combines
  ERC-4337 gas simulation with `simulateCalls` asset-change and native-transfer
  tracing, then exposes only the bounded protocol context to policies.
- `src/billing/` — mainnet/testnet meter classification, Alchemy ETH/USD quote
  decoding, conservative micro-USD arithmetic, Alchemy's sponsorship fee, pessimistic
  sponsorship reservation, and receipt-based actual-cost settlement.
- `src/policy/` — exhaustive EVM policy definitions and lifecycle service. The
  registry remains declarative, generic state/reservation adapters live in
  `operations.ts`, and individual handlers live in `src/policy/policies/`.
- `src/signatures/` — provider signature conversion for EVM validators.
- `src/signing/` — smart-account message and EIP-712 signing and verification
  exposed as `evm.sign` and `evm.verifySignature`; raw digest signing is not
  supported.
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

EVM-specific billing remains in this package. Simulation prepares without a
paymaster. Execution prepares with Alchemy Rundler and Gas Manager, and sponsored mainnet preparation
attaches a persisted price/cost envelope. `application` only reserves and
settles the generic meter amounts returned here, preserving the namespace
boundary for future Solana support.

Provider ECDSA signatures are DER encoded. Use
`derSignatureToEvmSignature` to produce the validator representation:
P-256 validators receive fixed-width `r || s`, while secp256k1 validators
receive `r || s || v` after recovery parity is matched against the stored public
key. The secp256k1 variant requires the exact digest that the provider signed.

## Environment

| Variable                    | Required | Purpose                                      |
| --------------------------- | -------- | -------------------------------------------- |
| `EVM_ALCHEMY_API_KEY`       | Yes      | Alchemy RPC, Rundler, and Gas Manager key.   |
| `EVM_ALCHEMY_GAS_POLICY_ID` | Yes      | Gas Manager policy used for sponsored calls. |

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
the exact signed payload to Alchemy Rundler. `getReceipt` and `waitForReceipt` normalize
confirmed receipts and return `Option.none` while a receipt is unavailable or a
bounded wait expires. `getStatus` uses Rundler's lifecycle status method so
reconciliation can distinguish unknown, pending, preconfirmed, and mined operations.
Rundler has no dedicated bulk receipt action, so background processing batches
database claims and performs bounded concurrent lookups across their chains.

`evm.policy` evaluates one complete decoded EVM policy set and owns its
`reserve`, `settle`, and `release` lifecycle. `evm.time-window` is stateless and
uses the prepared block timestamp with an inclusive start and exclusive
expiration. `evm.chain-allowlist` is a stateless execution and signature
constraint over a non-empty unique set of supported CAIP-2 networks; it does not
grant signature access by itself. `evm.native-spend-limit` tracks spent and
in-flight native value per CAIP-2 chain and fixed UTC allowance window so concurrent executions cannot
consume the same allowance. It supports per-operation, hourly, daily, weekly,
monthly, and lifetime limits; weekly windows begin Monday at 00:00 UTC. Window
resets use context-derived state keys rather than a scheduled reset. An
unconfigured chain permits zero-value calls but denies any positive native
value. `evm.gas-budget` reserves the prepared UserOperation's maximum native gas cost
across per-chain UTC hour/day/week or lifetime budgets. Confirmation replaces
that pessimistic reservation with `actualGasCost`; definitive failure releases
it. Missing chain configuration denies execution. Each handler owns the schemas
used to decode persisted state and reservations
plus the context-derived seeds for any missing state. Registry
priorities define denial precedence and policy IDs provide a stable tie-breaker,
so caller array order cannot change evaluation, reservation, settlement, or
release behavior.
Each registry definition also declares whether its type is singleton or
repeatable. The registry materializes persisted policy IDs and applicability,
so application workflows do not branch on policy names.

`evm.sign` reconstructs the stored Kernel or Safe account on the requested
supported chain and delegates either UTF-8 message signing or EIP-712 typed-data
signing to the smart account. Callers provide the provider-neutral account
reconstruction input; database access and grant selection remain in
`application`.

`evm.verifySignature` reconstructs the same account and verifies the original
message or typed data through the chain public client. Deployed Kernel and Safe
accounts use ERC-1271. Counterfactual accounts supply their deterministic
factory and initialization data to Viem's ERC-6492 deployless verifier. Invalid
signatures return `false`; account, chain, and RPC failures remain typed adapter
errors. Verification never invokes the wallet-key signer.

Preparation records the standardized `eth_estimateUserOperationGas` result in
the policy context. This verifies EntryPoint validation and execution before
signing; the adapter does not claim provider-specific token balance changes.

`Evm.testLayer` supplies a deterministic adapter for server boundary tests.
Use `Evm.testLayerWith({ execution: { ... } })` to override only the behavior a
test needs while retaining the real policy registry and the rest of the
deterministic execution lifecycle.
