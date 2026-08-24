# `@namera-ai/ens`

Private Effect service for managing Namera ENS identities through Namespace's
offchain manager. The package owns provider configuration and translates the
provider's Promise API and errors into a typed Effect boundary.

## Configuration

| Variable                     | Required | Description                                       |
| ---------------------------- | -------- | ------------------------------------------------- |
| `NAMERA_ID_OFFCHAIN_API_KEY` | Yes      | Namespace address-based offchain manager API key. |

The API key is loaded as a redacted Effect configuration value and is never
accepted by individual operations.

## Service

`Ens` exposes subname lifecycle, availability and lookup operations, plus
address, text, and data record management. Provider request and response types,
chain names, and validation helpers are re-exported from the package entry
point so consumers do not need to import the provider SDK directly.

```ts
import { ChainName, Ens } from "@namera-ai/ens";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const ens = yield* Ens;

  yield* ens.createSubname({
    parentName: "namera.id",
    label: "alice",
    owner: "0x0000000000000000000000000000000000000000",
    addresses: [
      {
        chain: ChainName.Ethereum,
        value: "0x0000000000000000000000000000000000000000",
      },
    ],
  });
});

program.pipe(Effect.provide(Ens.layer));
```

`Ens.layer` uses Namespace mainnet. `Ens.devLayer` uses the SDK's Sepolia mode,
and `EnsTestLayer` provides an in-memory deterministic substitute with resettable
availability state for boundary tests. Runtime environment selection belongs to
the server composition root.

## Commands

```sh
pnpm --filter @namera-ai/ens typecheck
pnpm --filter @namera-ai/ens test
pnpm --filter @namera-ai/ens build
```
