# @namera-ai/application

The backend use-case layer and center of Namera's business logic. It composes
repositories and provider services into raw operations such as magic-link sign
in, session management, and future backend workflows. It is independent of HTTP
and does not perform API authorization checks; `apps/server` owns those checks
and adapts HTTP requests to application methods.

## Structure

- `src/application.ts` — the single aggregate `Application` service and live layer.
- `src/audit/` — internal typed audit-event writer used by application workflows.
- `src/auth/core/` — focused user and session operations.
- `src/auth/magic-link/` — request and verification workflows.
- `src/auth/organization/` — organization, member, invitation, and setup operations.
- `src/auth/organization/helpers.ts` — shared transactional user and organization setup.
- `src/auth/config.ts` — environment-backed authentication configuration.
- `src/auth/data.ts` — code-owned authentication policy and defaults.
- `MAGIC_LINK.md` — implementation contract for magic-link authentication.

Future feature folders should add a focused operation builder to the aggregate
service. Infrastructure capabilities remain focused `Context.Service` values
that the aggregate can consume.

## Adding an operation

1. Put the operation in the smallest matching feature file and expose it through
   the existing `Application` aggregate; do not create a parallel application
   service for each entity.
2. Yield repositories and provider services once in the feature builder. Define
   the public operation with `Effect.fn("Application.feature.operation")`.
3. Enforce business invariants here, but leave HTTP actor permissions, cookies,
   headers, and status codes in `apps/server`.
4. Wrap dependent writes in `TransactionService.run`. Repository calls inside
   it automatically use the same transaction.
5. Append the typed audit event inside that transaction for successful state
   changes. Do not audit reads or failed changes. Add or update the event union
   in `protocol` first.
6. Add a shared metric only for useful aggregate behavior and bounded labels.
   Emit short semantic logs at meaningful transitions; never log credentials,
   email content, or arbitrary request payloads in shared or production layers.
   Provider-owned local development layers may deliberately expose test data,
   as documented by that provider package.
7. Add the provider test layer in the owning package and exercise the operation
   through server feature tests.

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

Successful mutations append audit events in the same `TransactionService.run`
boundary as the state change. Read-only operations are not audited. Audit data
must remain safe historical context and must never contain credentials.

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
import { AuthConfig } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";

const CryptoLive = CryptoService.layer.pipe(Layer.provide(NodeCrypto.layer));

const program = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  return yield* crypto.randomToken(config.magicLink.tokenBytes);
});
```

Effect's `Crypto` service provides secure randomness and SHA digests. The
shared crypto service adds purpose-separated HMAC and AES-GCM operations.
`apps/server` must provide `NodeCrypto.layer`.

Do not import API route definitions or read `process.env` in application use
cases. Validate public input in protocol/API schemas and keep use cases focused
on business behavior and atomic coordination.
