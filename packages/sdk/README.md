# @namera-ai/sdk

Scoped, revocable permissions for agent wallets on ERC-7579 smart accounts.

## Install

```sh
pnpm add @namera-ai/sdk effect@^4
```

`effect` is a peer dependency: install it next to `@namera-ai/sdk`.

## Usage

Every SDK operation is an `Action`: call it for a Promise, or use `.effect` for the Effect with
typed failures.

```ts
import { Effect } from "effect";

import { Action } from "@namera-ai/sdk";

const double = Action.make((value: number) => Effect.succeed(value * 2));

await double(21); // 42
await Effect.runPromise(double.effect(21)); // 42
```

## License

[Apache-2.0](./LICENSE)
