# Namera repository guide

Namera is a programmable wallet backend. Agents can execute onchain operations
within permissions defined by users and organizations. This repository is a
pnpm/Turborepo TypeScript monorepo targeting Node.js 24 and using Effect v4.

## Package map

- [`apps/server`](apps/server/README.md) — Node HTTP runtime, transport
  middleware, API handlers, authorization, and live layer composition.
- [`apps/dashboard`](apps/dashboard/README.md) — Vite React dashboard using
  TanStack Router and the shared UI package.
- [`packages/protocol`](packages/protocol/README.md) — shared schemas, models,
  DTOs, branded IDs, and typed errors.
- [`packages/utils`](packages/utils/README.md) — shared helpers that do not
  depend on Effect services or application state.
- [`packages/database`](packages/database/README.md) — Drizzle schema,
  PostgreSQL layer, transactions, and repositories.
- [`packages/emails`](packages/emails/README.md) — typed hosted-template email
  delivery through Resend.
- [`packages/telemetry`](packages/telemetry/README.md) — Effect OTLP exporters
  and shared low-cardinality metric definitions.
- [`packages/ui`](packages/ui/README.md) — shared React components imported
  directly from TypeScript source.
- [`packages/application`](packages/application/README.md) — backend use cases
  and business workflow composition.
- [`packages/api`](packages/api/README.md) — public Effect `HttpApi` definition;
  no handlers or server runtime.
- [`packages/template`](packages/template/README.md) — starter for new workspace
  packages.

Read the relevant package README before changing that package.

## Dependency direction

```text
apps/server              runtime, handlers, authorization, environment, live layers
  ├── packages/api       HTTP contracts
  └── packages/application
        ├── packages/database
        ├── packages/emails
        ├── packages/protocol
        └── packages/utils
```

Additional rules:

- `api` may depend on `protocol`; it must not contain handlers or business logic.
- `database` and `emails` may depend on `protocol`; they must not depend on
  `application` or `api`.
- `telemetry` contains vendor export layers and shared metric definitions. It
  must not depend on application or transport packages.
- `protocol` must not depend on infrastructure or application packages.
- `utils` must not depend on project Effect services. Reuse it before creating
  duplicate low-level helpers.
- `application` must not import `api` or `apps/server`.
- `apps/server` is the composition root. It provides Node/runtime layers,
  implements API handlers and authorization, and reads deployment environment.

## Effect v4

Before writing Effect code, read `node_modules/effect/AGENTS.md` completely and
follow its linked local documentation when relevant. Search
`node_modules/effect/src` for APIs not covered there.

- Define services with class-based `Context.Service` and construct
  implementations with `Layer`.
- Use `Effect.gen` for workflows and `Effect.fn("Service.operation")` for
  functions returning effects.
- Model expected failures with `Schema.TaggedError`; do not hide unexpected
  defects.
- Use Effect `Schema` to decode untrusted input and derive TypeScript types from
  schemas.
- Use Effect `Config` and `Redacted` for runtime configuration and secrets.
- Use platform services such as `Crypto.Crypto`; provide Node implementations
  such as `NodeCrypto.layer` from the server composition root.
- Keep layers focused. Use `Layer.provide` when dependencies should not leak to
  consumers.

## Project practices

- Keep implementations simple. Validate data at external and persistence
  boundaries; do not add redundant validation for code-owned constants or
  trusted configuration.
- Brand values only when identity or confusion between values would cause a real
  defect. Do not brand every string.
- Put public request/response schemas and typed errors in `protocol`. Keep
  sensitive persistence fields out of public DTOs.
- Put business workflows in `application`, transport definitions in `api`, HTTP
  handlers and authorization in `apps/server`, and queries in `database`.
- Repository methods must work with both the normal database and
  `TransactionService.run`; use the existing transaction context rather than
  passing raw transaction clients through public APIs.
- Store credential digests/HMACs, not raw session or verification credentials.
- Use readonly arrays and objects unless mutation is required.
- Use `#/*` for internal package imports. Use package exports for cross-package
  imports. Include `.js` on relative ESM imports.
- Export only supported public APIs from each package entry point.
- Preserve the `namera-source` development condition and unbundled package build
  unless a package has a documented reason to differ.
- Keep dependencies owned by the package that uses them.
- Preserve unrelated worktree changes.

### Frontend UI

- Use `@namera-ai/ui` for shared components, hooks, icons, utilities, and
  styles. Imports shown as `@thenamespace/uikit` in the
  [Namespace UIKit docs](https://namespace-uikit.vercel.app/llms.txt) map to
  `@namera-ai/ui` in this repository.
- Use UIKit semantic color and typography tokens; do not hardcode palette
  colors in application UI.
- Prefer UIKit components for interactive controls, forms, feedback, surfaces,
  and typography. Use semantic HTML for page structure and router primitives
  for application navigation.
- Preserve accessible names, visible focus, keyboard behavior, field
  descriptions and errors, and live announcements for asynchronous feedback.
- In `apps/dashboard`, prefetch protected data with the router-owned Effect atom
  registry so loaders and React hooks share the same cache.

## Common commands

```sh
pnpm check
pnpm build
pnpm typecheck
pnpm lint
pnpm format
```

Run package-specific commands with `pnpm --filter <package> <script>`. Before
committing, run the narrowest relevant checks followed by `pnpm check` for
cross-package changes.

Use conventional commits with small, direct messages. Commit after each
meaningful change.
