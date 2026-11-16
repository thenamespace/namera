# @namera-ai/contracts

ABIs (and, once deployed, addresses) of Namera's Smart Sessions contracts: `SmartSession` and
`ECDSASessionValidator`. Generated from the Foundry project in `contracts/`.

```ts
import { smartSessionAbi } from "@namera-ai/contracts";
```

## Development

| Command               | What it does                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `pnpm generate`       | Regenerate `src/abis` from `contracts/out` (run `forge build` first) |
| `pnpm generate:check` | Fail if the committed ABIs differ from the Foundry build             |
| `pnpm build`          | Build `dist/` with tsdown                                            |
| `pnpm test`           | Run the tests (Vitest)                                               |
