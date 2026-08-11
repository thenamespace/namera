# @namera-ai/evm

EVM chain adapter infrastructure for Namera. It currently owns supported-chain
metadata, provider RPC URLs, and cached Alchemy, Pimlico bundler, and Pimlico
paymaster clients.
Smart-account construction, execution, and policy evaluation will be added
behind the same root `Evm` service.

## Structure

- `src/chains/` — supported Viem chains, CAIP-2 metadata, and lookups.
- `src/clients/` — internal cached Viem public, bundler, and paymaster clients.
- `src/config.ts` — redacted provider credentials.
- `src/layer.ts` — root `Evm` service and live layer.

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
clients stay internal to this package and are used to implement focused wallet
and execution operations without exposing their generic types to consumers.
