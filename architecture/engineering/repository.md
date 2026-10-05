# Repository and package boundaries

Namera is a pnpm/Turborepo TypeScript monorepo targeting Node.js 24 and Effect
v4. Packages expose narrow public entry points and use the `namera-source`
condition for direct source consumption during development.

## Dependency versions

The workspace pins Effect and its platform, SQL, Atom, OpenTelemetry, and Vitest
adapters to 4.0.1. The `@effect/tsgo` editor tool is versioned independently.
Import platform modules from `effect/http`,
`effect/http-api`, `effect/sql`, and the other stable paths, not `effect/unstable/*`.
Encoding helpers live in `effect/encoding/*`. Keep the CLI npm shrinkwrap in sync
with the pnpm catalog using `pnpm cli:lock`, then run `pnpm pack:check` before release.

Direct dependencies track the latest releases accepted by pnpm's supply-chain
policies, with this explicit exception:

- Drizzle ORM and Kit stay on the standard `rc` channel (1.0.0-rc.4), not
  experimental snapshot tags. Its existing Effect error-constructor patch remains.

The dashboard uses UA Parser v2 with its bundled TypeScript declarations. Its
AGPL/commercial licensing change was accepted for this upgrade; the old v1 hold
and separate `@types/ua-parser-js` dependency have been removed.

TypeScript 7.0.2 uses tsdown's `tsgo` declaration generator. Klarity 0.3.0
suppresses its known experimental-API warning while keeping other build warnings
fatal, and supports Vitest 5 without a peer override.

`@effect/tsgo` replaces the JavaScript Effect language-service package. `pnpm
install` patches the native TypeScript binary through the root `prepare` script;
installs with `--ignore-scripts` must run `pnpm exec effect-tsgo patch --typescript
--no-oxlint` to enable the editor integration. VS Code-based editors should use
the TypeScript 7 extension and workspace compiler, then restart the TS server.
The plugin configuration still uses the `@effect/language-service` name, as
required by the native integration. Effect diagnostics remain editor feedback,
not new CI failure conditions; TypeScript errors still fail checks. Oxlint is
not patched. Container builds can use the unpatched compiler. Every package
extends the root config before its Klarity preset; Turbo tracks that shared
config as a global dependency so editor/compiler changes invalidate cached checks.

A scoped peer exception covers React Hook Form's Standard Schema resolver with
Effect 4. Do not import the resolver package's Effect 3-specific adapter.

Oxlint's new React Compiler migration diagnostics are warnings while the compiler
is not enabled. Existing correctness, Hooks, and accessibility checks remain active.

## Dependency direction

```mermaid
flowchart TD
  Dashboard[apps/dashboard] --> API[packages/api]
  Dashboard --> Protocol[packages/protocol]
  Dashboard --> UI[packages/ui]
  Dashboard --> Telemetry[packages/telemetry]

  Server[apps/server] --> API
  Server --> Application[packages/application]
  Server --> Database[packages/database]
  Server --> Crypto[packages/crypto]
  Server --> Emails[packages/emails]
  Server --> EVM[packages/evm]
  Server --> WalletKeys[packages/wallet-keys]
  Server --> Telemetry

  Application --> Protocol
  Application --> Database
  Application --> Crypto
  Application --> Emails
  Application --> EVM
  Application --> WalletKeys
  Application --> Telemetry
  Application --> Utils[packages/utils]

  API --> Protocol
  Database --> Protocol
  Crypto --> Protocol
  EVM --> Protocol
  Emails --> Protocol
  WalletKeys --> Protocol
  UI --> Protocol

  SDK[packages/sdk] --> API
  CLI[apps/cli] --> SDK
```

Lower layers must not import orchestration or transport layers. In particular,
`protocol` has no infrastructure dependency; `api` contains contracts but no
handlers; `application` does not import `api` or server code; provider packages
do not import application workflows.

## Workspace responsibilities

| Workspace              | Responsibility                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `apps/server`          | Node runtime, middleware, actor authentication, rate limits, HTTP/MCP handlers, workers, live Layer composition. |
| `apps/dashboard`       | Vite/React dashboard, route loaders, Effect Atom queries, forms, and product presentation.                       |
| `apps/cli`             | Effect CLI, OAuth device login, keyring profiles, interactive prompts, output formatting.                        |
| `apps/email-templates` | React Email preview and generation of email-safe PNG assets.                                                     |
| `packages/protocol`    | Effect Schemas, branded identities, models, public DTOs, and expected errors.                                    |
| `packages/database`    | Drizzle schemas, migrations, PostgreSQL/PGlite layers, transactions, repositories.                               |
| `packages/application` | Business workflows, transaction boundaries, billing enforcement, audit and notification orchestration.           |
| `packages/api`         | Public typed `HttpApi` declaration and authentication middleware contracts.                                      |
| `packages/crypto`      | Purpose-separated HMAC, AES-GCM encryption, tokens, and numeric codes.                                           |
| `packages/emails`      | Encrypted durable email jobs, worker, Resend provider, and runtime React Email templates.                        |
| `packages/wallet-keys` | Provider-neutral key lifecycle with local and Google Cloud KMS layers.                                           |
| `packages/evm`         | Chain registry, clients, smart accounts, simulations, execution, signing, verification, and policy handlers.     |
| `packages/telemetry`   | OTLP exporters, service identity, HTTP normalization, and shared bounded metrics.                                |
| `packages/sdk`         | Fetch-based Promise client over the generated API contract.                                                      |
| `packages/ui`          | Shared source-only React components and Namespace UIKit exports.                                                 |
| `packages/utils`       | Dependency-light deterministic helpers without Effect services or application state.                             |

## Source organization

`apps/web` owns the public website scaffold using TanStack Start and Fumadocs.
Its `/` landing route is empty, `/docs` serves the local MDX collection, and
`/api/search` searches that public content. It consumes `packages/ui` styles
and has no backend API, authentication, persistence, or telemetry integration.
These read-only routes do not create audit events. See the
[web README](../../apps/web/README.md) for local commands and content structure.
Production hosting and website content remain pending.

- Internal package imports use `#/*`; cross-package imports use package exports.
- Relative ESM imports include `.js`.
- Domain folders own their service, models, helpers, repositories, and tests.
- A package barrel exports only the supported public surface. Internal provider
  clients and persistence details do not leak through package roots.
- Split executable feature files when they combine distinct workflows or become
  difficult to scan. Large declarative schemas or registries may remain intact
  when splitting would obscure ownership.
- Shared helpers move to `utils` only when multiple packages need the same
  dependency-light behavior. Resourceful, configurable, or substitutable
  capabilities are Effect services in their owning package.

## Runtime ownership rule

The server is the composition root. It selects live providers, supplies secrets
through Effect `Config`, runs migrations and workers, and exposes transport.
Application workflows receive interfaces such as repositories, `WalletKeys`,
EVM, EmailJobs, and telemetry; they do not select concrete providers.

## Pending

- Remove `packages/template` when package scaffolding moves to a maintained
  generator, or keep it synchronized with repository conventions.
