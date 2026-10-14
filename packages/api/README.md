# @namera-ai/api

Effect `HttpApi` contract for Namera. Generate OpenAPI documents and derive typed
clients from the endpoint schemas used by the server. This package declares HTTP
interfaces; it does not run a server or implement business logic.

For application integrations, use the promise-based
[@namera-ai/sdk](https://www.npmjs.com/package/@namera-ai/sdk).

## Requirements

Node.js 24.14+ for Node applications. Examples use Effect 4.0.1, matching the
package's runtime dependency.

## Installation

Choose your package manager:

```sh
npm install @namera-ai/api effect@4.0.1
pnpm add @namera-ai/api effect@4.0.1
yarn add @namera-ai/api effect@4.0.1
bun add @namera-ai/api effect@4.0.1
```

## Quick start

Save this as `index.ts` and run `node index.ts` to generate `openapi.json`:

```ts
import { writeFile } from "node:fs/promises";
import { OpenApi } from "effect/http-api";
import { NameraApi } from "@namera-ai/api";

const document = OpenApi.fromApi(NameraApi);
await writeFile("openapi.json", JSON.stringify(document, null, 2));
```

The contract includes account, session-key, execution, signature, authentication,
organization, billing, and identity interfaces. Internal operator endpoints carry
OpenAPI exclusion annotations and are not part of the generated public spec.

## Derive client types

```ts
import type { HttpApiClient } from "effect/http-api";
import type { NameraApi } from "@namera-ai/api";

export type NameraHttpClient = HttpApiClient.ForApi<typeof NameraApi>;
export type WalletHttpClient = NameraHttpClient["wallet"];
```

`HttpApiClient.make` constructs an Effect client when supplied with an HTTP layer
and the required client middleware. Authentication and actor permissions are
endpoint-specific. A typed client does not grant access to owner-only or operator
actions. Use the SDK when you do not need to compose Effect middleware yourself.

## Documentation

- [SDK integration](https://namera.ai/docs/sdk)
- [Contract architecture](https://github.com/thenamespace/namera/blob/main/architecture/integrations/contracts.md)
- [Runtime schemas](https://www.npmjs.com/package/@namera-ai/protocol)

Use matching versions of the API, protocol, SDK, and CLI packages.
