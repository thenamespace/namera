# @namera-ai/server

The Node.js 24 HTTP runtime for Namera. It implements the typed API, enforces
transport authorization, composes application/provider layers, and runs durable
workers. Scalar API reference is served at `/reference`.

## Local development

From the repository root, start PostgreSQL and Grafana LGTM and copy the example
configuration. Supply required provider values before startup.

```sh
pnpm dev:services:up
cp apps/server/.env.example apps/server/.env
pnpm --filter @namera-ai/server dev
```

The default listener is `0.0.0.0:8080`; the default dashboard origin is
`http://localhost:3000`. Migrations and system-role synchronization complete before
HTTP and workers start.

## Configuration

Use [`.env.example`](.env.example) locally and
[`.env.prod.example`](.env.prod.example) for deployment. Populated environment
files must not be committed or included in container images.

Server settings are `SERVER_HOST`, `SERVER_PORT`, `SERVER_CORS_ORIGIN`, optional
`WAITLIST_CORS_ORIGIN`, `ADMIN_CORS_ORIGIN`, and `ADMIN_BOOTSTRAP_OWNER_EMAIL`.
Composed packages own PostgreSQL, crypto, authentication, Alchemy, Namespace ENS,
1Claw, Resend and telemetry configuration.

Production ingress must overwrite client-IP headers and prevent direct origin
access. Rate limits use one process-local store. Exact dashboard and admin Origins
protect sensitive browser writes independently of CORS.

## Layout

- `src/layers/` — HTTP server and live dependency/worker composition.
- `src/middlewares/` — authorization, limits, security and telemetry.
- `src/routes/` — typed handlers and OAuth/proxy routes.
- `src/helpers/` — actor enforcement, DTO mapping and cookies.
- `src/workers/` — execution, session, wallet, billing and analytics loops.
- `tests/integration/` — HTTP tests with real application/database layers.

Handlers call `Application`; they do not implement provider signing or queries.
`/internal` routes require platform membership and are excluded from public OpenAPI.

## Checks and deployment

```sh
pnpm --filter @namera-ai/server test
pnpm --filter @namera-ai/server typecheck:test
pnpm --filter @namera-ai/server build
pnpm --filter @namera-ai/server start
docker build --file apps/server/Dockerfile --tag namera-server .
```

The Docker image uses a pruned production workspace. Configuration is injected
when the container starts. Workers share the server scope and stop on shutdown.

See [server architecture](../../architecture/runtime/server.md),
[authentication](../../architecture/identity-access/authentication.md), and
[observability](../../architecture/runtime/observability.md).
