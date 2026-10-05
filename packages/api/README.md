# @namera-ai/api

The typed HTTP contract for Namera, built with Effect `HttpApi`. Generate OpenAPI
documentation and derive client types from the same endpoint schemas used by the
server. This package defines the API; it does not start a server.

For ordinary application integration, use [@namera-ai/sdk](https://www.npmjs.com/package/@namera-ai/sdk).

## Installation

Requires Node.js 24.14+ for Node applications. Use the matching Effect 4 stable release.

```sh
npm install @namera-ai/api effect@4.0.1
pnpm add @namera-ai/api effect@4.0.1
yarn add @namera-ai/api effect@4.0.1
bun add @namera-ai/api effect@4.0.1
```

Choose the command for your package manager.

## Generate OpenAPI documentation

```ts
import { writeFile } from "node:fs/promises";
import { OpenApi } from "effect/http-api";
import { NameraApi } from "@namera-ai/api";

const document = OpenApi.fromApi(NameraApi);
await writeFile("openapi.json", JSON.stringify(document, null, 2));
```

The contract covers wallets, session keys, executions, signatures, authorization,
organizations, billing, and the public waitlist. Authentication is defined per
endpoint; installing this package grants no access.

## Derive client types

```ts
import type { HttpApiClient } from "effect/http-api";
import { NameraApi } from "@namera-ai/api";

type Client = HttpApiClient.ForApi<typeof NameraApi>;
type WalletClient = Client["wallet"];
```

Effect integrations can construct clients with `HttpApiClient.make` and supply
the required client middleware layers. Most consumers should use the SDK, which
handles authentication and returns promise-based results.

## Related packages

- [protocol](https://www.npmjs.com/package/@namera-ai/protocol): runtime schemas and types.
- [sdk](https://www.npmjs.com/package/@namera-ai/sdk): application client.
- [cli](https://www.npmjs.com/package/@namera-ai/cli): terminal commands and local MCP.

Use matching versions of the four packages starting with 1.0.0.
[Contributor architecture](https://github.com/thenamespace/namera-core/blob/main/architecture/packages/contracts.md).
