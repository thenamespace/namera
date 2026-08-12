# @namera-ai/server

The Node.js composition root for the Namera API. It owns the HTTP runtime,
transport middleware, API handler implementations, authorization, and assembly
of live infrastructure and application layers.

The server exposes the `@namera-ai/api` contract through Scalar at `/reference`
and delegates authenticated workflows to `@namera-ai/application` services.

## Structure

- `src/config.ts` — server host, port, and browser origin configuration.
- `src/routes/` — grouped HTTP handler layers, root route, health route, and
  Scalar API reference.
- `src/helpers/` — actor enforcement, DTO mapping, and cookie helpers.
- `src/middlewares/` — authorization, CORS, and rate-limit middleware.
- `src/rate-limit.ts` — code-owned route policies and keyed limit helpers.
- `src/layers/` — runtime and dependency composition.
- `src/index.ts` — Node process entry point.

Before binding the HTTP port, the server applies pending database migrations
and synchronizes the canonical system roles through
`@namera-ai/database/DatabaseMigration`.

After migrations complete, the server starts the scoped email worker. It polls
the durable outbox, uses leases safe for multiple instances, and stops with the
server scope. HTTP requests only enqueue email work.

`@namera-ai/telemetry` exports logs, traces, and metrics over OTLP. HTTP tracing
is enabled globally except for the Scalar reference route.

## Rate limiting

The server uses Effect's process-local in-memory `RateLimiter`. One shared layer
backs both the global IP limit and stricter operation limits. Policies are kept
in `src/rate-limit.ts`; each counter is isolated by a namespaced key such as
`magic-link.request.ip:<address>`.

For a new sensitive operation, add its policy under `rateLimitPolicy`, then call
`consumeRateLimit` in the route before invoking the application method. Use a
stable, low-cardinality scope name and an appropriate identifier such as the
client address, authenticated user ID, organization ID, or normalized email.
Never include the identifier in logs or metric attributes.

The in-memory store is suitable while the server runs as a single instance. It
resets on restart and does not coordinate between replicas. Before horizontally
scaling the server, replace `RateLimiter.layerStoreMemory` with Effect's Redis
store while retaining the policies and namespaced keys.

Client addresses currently come from the server connection. Only enable
forwarded-address middleware when the origin accepts traffic exclusively from a
trusted reverse proxy; otherwise clients can spoof the forwarded header.

## Adding a handler

Authenticated handlers follow this order:

1. Call `enforceCurrentUser(requiredPermissions)` and keep only the returned
   actor data.
2. Apply transport concerns required by that endpoint: rate limits, request
   metadata, cookies, cache headers, or response status.
3. Call one operation on `Application` and map domain values to public DTOs.

Handlers must not query repositories for business data or coordinate workflows.
Authorization and HTTP adaptation belong here; intrinsic business invariants and
transactions belong in `application`. Keep one route file per API group and use
the matching group/folder names from `@namera-ai/api`.

## Environment

Copy `.env.example` to `apps/server/.env` for local development. Server-owned
values have defaults; composed package configuration remains required unless its
own README documents a default.

| Variable             | Default                 | Purpose                         |
| -------------------- | ----------------------- | ------------------------------- |
| `SERVER_HOST`        | `0.0.0.0`               | HTTP listen host.               |
| `SERVER_PORT`        | `8080`                  | HTTP listen port.               |
| `SERVER_CORS_ORIGIN` | `http://localhost:3000` | Allowed credentialed UI origin. |

The composition root also loads:

- PostgreSQL configuration from `@namera-ai/database`;
- authentication origins from `@namera-ai/application`;
- cryptographic secrets from `@namera-ai/crypto`;
- Alchemy and Pimlico credentials from `@namera-ai/evm`;
- local or GCP signer configuration from `@namera-ai/wallet-keys`;
- local LGTM or production Axiom configuration from `@namera-ai/telemetry`;
- Resend configuration from `@namera-ai/emails` outside development.

The complete local set and provider-specific comments are kept in
`apps/server/.env.example`. Package READMEs remain authoritative for each
service's variables.

Only one exact CORS origin is allowed because credentialed requests must not use
a wildcard origin.

`WALLET_KEYS_PROVIDER` defaults to `local`. When it is `gcp-kms`, also set
`GCP_PROJECT_ID`, `GCP_KMS_LOCATION`, and `GCP_KMS_KEY_RING`. Authenticate with
Application Default Credentials; locally, `GOOGLE_APPLICATION_CREDENTIALS` may
point to a credential file. The configured key ring must already exist.

## Commands

```sh
pnpm --filter @namera-ai/server dev
pnpm --filter @namera-ai/server build
pnpm --filter @namera-ai/server start
pnpm --filter @namera-ai/server test
pnpm --filter @namera-ai/server typecheck:test
```

Server feature tests live in `tests/` and exercise the typed in-memory HTTP API
against the real application, repositories, transactions, authorization, and
PGlite migrations. Shared provider substitutes come from their owning packages.
See the root [`TESTING.md`](../../TESTING.md) before adding tests.

Start PostgreSQL and the local Grafana LGTM stack before the development server:

```sh
pnpm dev:services:up
```

PostgreSQL is available at `localhost:5432` using the credentials in
`.env.example`. Grafana is available at `http://localhost:3001`; OTLP/HTTP is
available at `http://localhost:4318`.

Use `pnpm dev:services:logs` to follow container logs and
`pnpm dev:services:down` to stop the stack. Named volumes preserve database and
LGTM data between restarts.
