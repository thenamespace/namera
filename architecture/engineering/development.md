# Development

Use the Node version in [.node-version](../../.node-version) and the pnpm version
in [package.json](../../package.json). The repository is a TypeScript monorepo
with pnpm workspaces and Turborepo.

## Local setup

```sh
pnpm install
pnpm dev:services:up
pnpm --filter @namera-ai/server dev
```

Copy the relevant app's `.env.example` to its local `.env` and configure providers
before starting. Run the dashboard separately:

```sh
pnpm --filter @namera-ai/dashboard dev
```

| Service                  | Local port |
| ------------------------ | ---------- |
| API                      | 8080       |
| Dashboard                | 3000       |
| Admin portal             | 3003       |
| Website or email preview | 4000       |
| PostgreSQL               | 5432       |
| Local Grafana            | 3001       |

[compose.yaml](../../compose.yaml) supplies PostgreSQL and the optional local
telemetry stack. Its database credentials are development-only.

## Dependency direction

Protocol schemas sit below the API and application. Database, chain, crypto,
passkey, and provider packages do not import application workflows. The server
is the composition root. Frontends call the API rather than repositories.

For a backend feature:

1. Define request/response schemas and expected failures in `protocol`.
2. Add persistence and repository operations in `database` if needed.
3. Implement the application workflow, transaction boundary, and audit/outbox effects.
4. Declare the API contract, then implement actor/transport handling in the server.
5. Add client atoms/hooks and UI after the contract exists.
6. Update the owning architecture page and verify the affected boundaries.

Reuse existing actor/origin checks. A shared schema is not authorization.
Transaction helpers must retain the current transaction context; do not expose
raw SQL clients through application APIs.

## Runtime and builds

Effect services use `Context.Service` and Layers. Workflows use `Effect.gen`
and named `Effect.fn` operations. Expected failures are schema-tagged errors;
unexpected defects are not converted into ordinary success.

Workspace development resolves `namera-source`; published packages resolve
built ESM and declarations. Preserve those export conditions and test source
resolution. Most packages build unbundled with tsdown. UI is source-only.
Use package-owned dependencies and explicit public exports.

```sh
pnpm check
pnpm test
pnpm pack:check
```

`check` runs formatting, lint, production/test typechecks, and builds.
`test` is separate. Run tarball checks after builds, not concurrently with them.
See [testing](testing.md) and [delivery](../runtime/delivery.md).

Repository contribution rules live in [AGENTS.md](../../AGENTS.md); package
READMEs contain local commands and entry points.
