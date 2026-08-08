# @namera-ai/application

The backend use-case layer and center of Namera's business logic. It composes
repositories and provider services into raw operations such as magic-link sign
in, session management, and future backend workflows. It is independent of HTTP
and does not perform API authorization checks; `apps/server` owns those checks
and adapts HTTP requests to application methods.

## Structure

- `src/application.ts` — the single aggregate `Application` service and live layer.
- `src/auth/core/` — focused user and session operations.
- `src/auth/magic-link/` — request and verification workflows.
- `src/auth/organization/` — organization, member, invitation, and setup operations.
- `src/auth/organization/helpers.ts` — shared transactional user and organization setup.
- `src/auth/config.ts` — environment-backed authentication configuration.
- `src/auth/data.ts` — code-owned authentication policy and defaults.
- `src/crypto/config.ts` — redacted cryptographic secrets.
- `src/crypto/data.ts` — stable domain-separation purposes.
- `src/crypto/layer.ts` — reusable hashing, HMAC, encryption, and random-value service.
- `MAGIC_LINK.md` — implementation contract for magic-link authentication.

Future feature folders should add a focused operation builder to the aggregate
service rather than exposing another public `Context.Service`.

## Usage

```ts
import { Effect } from "effect";
import * as Application from "@namera-ai/application";

const program = Effect.gen(function* () {
  const app = yield* Application.Application;
  return yield* app.organization.invitation.createInvitation(input);
});
```

`Application.layer` is the only application layer provided by the server.

## Environment

| Variable                       | Required | Purpose                                          |
| ------------------------------ | -------- | ------------------------------------------------ |
| `AUTH_API_PUBLIC_ORIGIN`       | Yes      | Public origin of `api.namera.ai`.                |
| `AUTH_DASHBOARD_PUBLIC_ORIGIN` | Yes      | Public dashboard origin.                         |
| `CRYPTO_HMAC_KEY`              | Yes      | Base64url key used by HMAC operations.           |
| `CRYPTO_ENCRYPTION_KEY`        | Yes      | Base64url AES key used by encryption operations. |

Editable TTLs, limits, cookie settings, and return paths live in
`src/auth/data.ts` rather than environment variables.

## Configuration and crypto

```ts
import { Effect, Layer } from "effect";
import { NodeCrypto } from "@effect/platform-node";
import { AuthConfig, CryptoService } from "@namera-ai/application";

const CryptoLive = CryptoService.layer.pipe(Layer.provide(NodeCrypto.layer));

const program = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  return yield* crypto.randomToken(config.magicLink.tokenBytes);
});
```

Effect's `Crypto` service provides secure randomness and SHA digests. The
application crypto service adds purpose-separated HMAC and AES-GCM operations.
`apps/server` must provide `NodeCrypto.layer`.

Do not import API route definitions or read `process.env` in application use
cases. Validate public input in protocol/API schemas and keep use cases focused
on business behavior and atomic coordination.
