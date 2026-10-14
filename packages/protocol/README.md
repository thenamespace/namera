# @namera-ai/protocol

Runtime schemas and TypeScript types for Namera accounts, session keys,
transactions, signatures, and API messages. Decode and encode data with the same
Effect schemas used by the backend, without importing its runtime.

## Requirements

Node.js 24.14+ for Node applications, or a modern browser bundler. Examples use
Effect 4.0.1, matching the package's runtime dependency.

## Installation

Choose your package manager:

```sh
npm install @namera-ai/protocol effect@4.0.1
pnpm add @namera-ai/protocol effect@4.0.1
yarn add @namera-ai/protocol effect@4.0.1
bun add @namera-ai/protocol effect@4.0.1
```

## Quick start

Save this as `index.ts` and run `node index.ts`:

```ts
import { Schema } from "effect";
import { Email } from "@namera-ai/protocol";

const email = Schema.decodeUnknownSync(Email)(" Person@Example.com ");
console.log(email);
```

The result is `person@example.com`. Invalid input throws a schema error. Use
`Schema.decodeUnknownEffect` when validation belongs in an Effect workflow.

## Encode an API request

```ts
import { Schema } from "effect";
import { JoinWaitlistRequest } from "@namera-ai/protocol/dto";

type Request = typeof JoinWaitlistRequest.Type;
type WireRequest = typeof JoinWaitlistRequest.Encoded;

const input: WireRequest = { email: "person@example.com" };
const request: Request = Schema.decodeUnknownSync(JoinWaitlistRequest)(input);
console.log(JSON.stringify(Schema.encodeSync(JoinWaitlistRequest)(request)));
```

`.Type` describes decoded values; `.Encoded` describes their transport form.
Some schemas transform dates or integer strings. Encode with the owning schema
instead of serializing decoded values directly.

## Exports

| Import                      | Purpose                                             |
| --------------------------- | --------------------------------------------------- |
| `@namera-ai/protocol`       | Primitives, identifiers, policies, and typed errors |
| `@namera-ai/protocol/dto`   | HTTP request and response schemas                   |
| `@namera-ai/protocol/evm`   | EVM chains, calls, permissions, and signing types   |
| `@namera-ai/protocol/model` | Domain and persistence models                       |
| `@namera-ai/protocol/local` | Local signer bindings and encrypted export formats  |

Use DTOs for public payloads. Persistence models can contain sensitive fields,
and local key-material schemas belong only in trusted client code. Never log
decrypted exports or passphrases.

Schemas establish structure, not authorization or cryptographic validity.
An accepted namespace or custody variant does not itself prove that a particular
operation is supported. The server enforces grants, policies, and account state.

## Documentation

- [SDK integration](https://namera.ai/docs/sdk)
- [Contract architecture](https://github.com/thenamespace/namera/blob/main/architecture/integrations/contracts.md)
- [HTTP contract](https://www.npmjs.com/package/@namera-ai/api)

Use matching versions of the protocol, API, SDK, and CLI packages.
