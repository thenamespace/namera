# @namera-ai/evm

EVM chain adapter infrastructure for Namera. It owns supported-chain metadata,
provider RPC URLs, internal Viem client factories, wallet-key WebAuthn owners,
and smart-account construction for Kernel and Safe. Execution and EVM policy
evaluation will be added behind the same root `Evm` service.

## Structure

- `src/chains/` — supported Viem chains, CAIP-2 metadata, and lookups.
- `src/clients/` — internal cached Viem public, bundler, and paymaster clients;
  these are deliberately absent from the package root exports.
- `src/accounts/` — shared smart-account creation, reconstruction, and
  wallet-key owner construction.
- `src/signatures/` — provider signature conversion for EVM validators.
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

`Evm.testLayer` supplies deterministic Kernel and Safe account results for
server boundary tests while preserving the public discriminated result shapes.
