# @namera-ai/server

The Node.js composition root for the Namera API. It owns the HTTP runtime,
transport middleware, API handler implementations, authorization, and assembly
of live infrastructure and application layers.

The server exposes the `@namera-ai/api` contract through Scalar at `/reference`
and delegates authenticated workflows to `@namera-ai/application` services.

## Structure

- `src/config.ts` — server host, port, and browser origin configuration.
- `src/routes/` — HTTP handler layers and the Scalar API reference route.
- `src/middlewares/` — transport middleware such as CORS and future authorization.
- `src/layers/` — runtime and dependency composition.
- `src/index.ts` — Node process entry point.

Before binding the HTTP port, the server applies pending database migrations
and synchronizes the canonical system roles through
`@namera-ai/database/DatabaseMigration`.

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

Future route files implement groups from `@namera-ai/api` and call services from
`@namera-ai/application`. Business workflows do not belong in this app.

## Environment

All values have local development defaults.

| Variable                      | Default                        | Purpose                              |
| ----------------------------- | ------------------------------ | ------------------------------------ |
| `SERVER_HOST`                 | `0.0.0.0`                      | HTTP listen host.                    |
| `SERVER_PORT`                 | `8080`                         | HTTP listen port.                    |
| `SERVER_CORS_ORIGIN`          | `http://localhost:3000`        | Allowed credentialed UI origin.      |
| `WALLET_KEYS_PROVIDER`        | `local`                        | Wallet signer: `local` or `gcp-kms`. |
| `WALLET_KEYS_LOCAL_DIRECTORY` | Repository `.data/wallet-keys` | Local development key directory.     |

Only one exact CORS origin is allowed because credentialed requests must not use
a wildcard origin.

When `WALLET_KEYS_PROVIDER=gcp-kms`, also set `GCP_PROJECT_ID`,
`GCP_KMS_LOCATION`, and `GCP_KMS_KEY_RING`. Authenticate with Application
Default Credentials; locally, `GOOGLE_APPLICATION_CREDENTIALS` may point to a
credential file. The configured key ring must already exist.

## Commands

```sh
pnpm --filter @namera-ai/server dev
pnpm --filter @namera-ai/server build
pnpm --filter @namera-ai/server start
```

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
