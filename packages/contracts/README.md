# @namera-ai/contracts

ABIs and deployment addresses of Namera's Smart Sessions contracts.

## Install

```sh
pnpm add @namera-ai/contracts effect@^4
```

`effect` is a peer dependency: install it next to `@namera-ai/contracts`.

## Usage

```ts
import { smartSessionAbi } from "@namera-ai/contracts";
import { encodeFunctionData, pad } from "viem";

const permissionId = pad("0x01", { size: 32 });

const removeSessionCall = encodeFunctionData({
  abi: smartSessionAbi,
  functionName: "removeSession",
  args: [permissionId],
});
```

The ABIs are generated from the Foundry project in [`contracts/`](../../contracts): run
`forge build` there, then `pnpm generate` here (`pnpm generate:check` fails when they are stale).

## License

[Apache-2.0](./LICENSE)
