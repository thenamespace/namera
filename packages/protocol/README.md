# @namera-ai/protocol

Runtime schemas and TypeScript types for Namera wallets, session keys,
transactions, signatures, and API messages. Validate input and encode wire data
using the same Effect schemas as the backend, without importing server code.

## Installation

Requires Node.js 24.14+ for Node applications, or a modern browser bundler.
Examples use the matching Effect 4 stable release.

```sh
npm install @namera-ai/protocol effect@4.0.1
pnpm add @namera-ai/protocol effect@4.0.1
yarn add @namera-ai/protocol effect@4.0.1
bun add @namera-ai/protocol effect@4.0.1
```

Choose one command.

## Validate and normalize input

```ts
import { Schema } from "effect";
import { Email } from "@namera-ai/protocol";

const email = Schema.decodeUnknownSync(Email)(" Person@Example.com ");
console.log(email); // person@example.com
```

Invalid input throws a schema error. Use `Schema.decodeUnknownEffect` when
validation belongs in an Effect workflow.

## Encode an API request

```ts
import { Schema } from "effect";
import { JoinWaitlistRequest } from "@namera-ai/protocol/dto";

type Input = typeof JoinWaitlistRequest.Encoded;
type Request = typeof JoinWaitlistRequest.Type;

const input: Input = { email: "person@example.com" };
const request: Request = Schema.decodeUnknownSync(JoinWaitlistRequest)(input);
const json = JSON.stringify(Schema.encodeSync(JoinWaitlistRequest)(request));
```

Use `.Encoded` for wire shapes and `.Type` for decoded values. Schemas can
transform dates and amounts, so use schema encoding before serializing.

## Import paths

| Import                      | Contents                                                 |
| --------------------------- | -------------------------------------------------------- |
| `@namera-ai/protocol`       | Shared primitives, branded identities, typed errors      |
| `@namera-ai/protocol/dto`   | API request and response schemas                         |
| `@namera-ai/protocol/evm`   | Chain identifiers, EVM calls, permissions and signatures |
| `@namera-ai/protocol/model` | Domain and persistence models                            |
| `@namera-ai/protocol/local` | Local signer bindings and encrypted key exports          |

Prefer DTOs for HTTP payloads: persistence models may contain sensitive fields.
Local key-material schemas belong only in trusted client code, never in logs,
analytics, or server payloads.

Schemas validate structure, not authorization, installation, or signature validity.
Full session responses include a public `signer` descriptor independent of account
ownership. The creation schema reserves `namera-managed` custody with provider
`1claw`, but runtime creation currently returns `MANAGED_SESSION_KEYS_UNAVAILABLE`.
Continue using local session signers until managed provisioning is enabled.
Use the [SDK](https://www.npmjs.com/package/@namera-ai/sdk) for API operations.
API, protocol, SDK and CLI share a version starting with 1.0.0.
[Contributor architecture](https://github.com/thenamespace/namera/blob/main/architecture/packages/contracts.md).
