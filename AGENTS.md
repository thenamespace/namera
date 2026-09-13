# Namera repository guide

Namera is a programmable wallet backend. Agents can execute onchain operations
within permissions defined by users and organizations. This repository is a
pnpm/Turborepo TypeScript monorepo targeting Node.js 24 and using Effect v4.

## Package map

- [`apps/server`](apps/server/README.md) — Node HTTP runtime, transport
  middleware, API handlers, authorization, and live layer composition.
- [`apps/dashboard`](apps/dashboard/README.md) — Vite React dashboard using
  TanStack Router and the shared UI package.
- [`apps/web`](apps/web/README.md) — TanStack Start public website scaffold
  with Fumadocs documentation and the shared UI theme.
- [`apps/email-templates`](apps/email-templates/README.md) — preview harness and
  email-safe asset generator for package-owned React Email templates.
- [`apps/cli`](apps/cli/README.md) — Effect CLI using OAuth device authorization
  and the public SDK for delegated wallet operations.
- [`packages/protocol`](packages/protocol/README.md) — shared schemas, models,
  DTOs, branded IDs, and typed errors.
- [`packages/crypto`](packages/crypto/README.md) — shared domain-separated
  hashing, HMAC, authenticated encryption, and credential generation.
- [`packages/utils`](packages/utils/README.md) — shared helpers that do not
  depend on Effect services or application state.
- [`packages/database`](packages/database/README.md) — Drizzle schema,
  PostgreSQL layer, transactions, and repositories.
- [`packages/emails`](packages/emails/README.md) — durable typed email jobs,
  background delivery, and the Resend provider adapter.
- [`packages/wallet-keys`](packages/wallet-keys/README.md) — provider-neutral
  wallet-key creation and signing through local files or Google Cloud KMS.
- [`packages/ens`](packages/ens/README.md) — Namespace-backed offchain ENS
  subname and record management.
- [`packages/passkeys`](packages/passkeys/README.md) — provider-neutral
  WebAuthn ceremony generation and verification.
- [`packages/evm`](packages/evm/README.md) — supported EVM chains, provider
  clients, smart-account construction, execution, signing, and policy logic.
- [`packages/telemetry`](packages/telemetry/README.md) — Effect OTLP exporters
  and shared low-cardinality metric definitions.
- [`packages/ui`](packages/ui/README.md) — shared React components imported
  directly from TypeScript source.
- [`packages/application`](packages/application/README.md) — backend use cases
  and business workflow composition.
- [`packages/api`](packages/api/README.md) — public Effect `HttpApi` definition;
  no handlers or server runtime.
- [`packages/sdk`](packages/sdk/README.md) — publishable typed client for API-key
  and OAuth-bearer access to the public API.
- [`packages/template`](packages/template/README.md) — starter for new workspace
  packages.

Read the relevant package README before changing that package.
Read the relevant feature document in [`architecture/`](architecture/README.md)
before changing a cross-package flow. Read
[`architecture/platform/telemetry.md`](architecture/platform/telemetry.md)
before adding or changing traces, logs, metrics, or browser OTLP behavior.

## Architecture knowledge base

Stable technical architecture is recorded in [`architecture/`](architecture/README.md).
It is the source of truth for cross-package flows, table invariants, security
boundaries, and concrete remaining production work.

- Read the owning architecture document before extending an existing feature.
- Update that document in the same change as a contract, table, repository,
  workflow, route, authorization rule, audit event, or runtime lifecycle change.
- Package-local structure and commands remain in package READMEs. Repository
  rules remain in `AGENTS.md`; do not duplicate them into feature documents.
- A schema or placeholder alone is not an implemented feature. State which
  boundaries are wired and tested.

## Feature flow

Add a backend feature in dependency order:

1. Define shared primitives, models, DTOs, and expected errors in `protocol`.
2. Add tables, constraints, relations, migrations, and focused repositories in
   `database` when persistence changes.
3. Implement the use case in `application`, including its transaction boundary,
   audit event, and only useful logs or low-cardinality metrics.
4. Declare the transport contract in `api`.
5. Implement the server handler: enforce the actor, apply transport policy such
   as rate limiting or cookies, call `Application`, and map the result.
6. Add frontend atoms, hooks, loader prefetching, and UI only after the contract
   exists.
7. Update the owning architecture document with the implemented boundaries,
   observability, audit coverage, tests, and concrete remaining work.

For successful mutations, decide explicitly whether an audit event is required.
State changes and their audit rows must share one transaction. Metrics describe
aggregate behavior and must use bounded attributes; audit events preserve typed
historical context. Logs should record concise decisions or transitions and must
not duplicate secrets or arbitrary payloads.

## Dependency direction

```text
apps/server      -> api, application, crypto, database, emails, telemetry, evm, wallet-keys
application      -> crypto, database, emails, evm, passkeys, telemetry, protocol, utils, wallet-keys
api              -> protocol
crypto           -> protocol, utils
database         -> protocol, utils
emails           -> crypto, database, telemetry, protocol
evm              -> protocol
wallet-keys      -> protocol
passkeys         -> utils
apps/dashboard   -> api, protocol, telemetry, ui
email-templates  -> emails, protocol, ui (preview and build-time asset generation only)
ui               -> protocol, Namespace UIKit
```

Additional rules:

- `api` may depend on `protocol`; it must not contain handlers or business logic.
- `crypto`, `database`, `evm`, and `wallet-keys` may depend on `protocol`; they
  must not depend on `application` or `api`.
- `emails` may depend on `crypto`, `database`, `telemetry`, and `protocol` to
  own its durable encrypted outbox and runtime React Email templates. It must
  not depend on `application`, `api`, or server runtime code.
- `telemetry` contains vendor export layers and shared metric definitions. It
  must not depend on application or transport packages.
- `apps/dashboard` sends browser OTLP only through the server telemetry proxy;
  provider endpoints and ingestion credentials must never enter the frontend.
- `protocol` must not depend on infrastructure or application packages.
- `utils` must not depend on project Effect services. Reuse it before creating
  duplicate low-level helpers.
- `application` must not import `api` or `apps/server`.
- Wallet key provider clients and private key material stay inside
  `packages/wallet-keys`; application workflows receive only the
  provider-neutral `WalletKeys` service.
- Application wallet workflows coordinate billing, key providers, chain
  adapters, persistence, audit events, notifications, and email enqueueing.
  Remote key/account creation happens before the final transaction; repeat the
  locked billing check inside that transaction before persisting the resource.
- Chain adapters such as `evm` own chain metadata, clients, account construction,
  execution, and chain-specific policy evaluation. They must not depend on
  `application` or `apps/server`.
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
- Enqueue emails through `EmailJobs` inside the business transaction. Do not
  call the provider adapter directly from application workflows.
- Use readonly arrays and objects unless mutation is required.
- Use `#/*` for internal package imports. Use package exports for cross-package
  imports. Include `.js` on relative ESM imports.
- Export only supported public APIs from each package entry point.
- Preserve the `namera-source` development condition and unbundled package build
  unless a package has a documented reason to differ.
- Keep dependencies owned by the package that uses them.
- Preserve unrelated worktree changes.
- Keep each feature file focused. Extend the existing aggregate service or
  barrel instead of creating a second competing entry point.
- Group files by domain once a flat directory stops being quickly scannable.
  Keep barrels at domain boundaries and preserve existing structure unless a
  reorganization is explicitly requested.
- Separate imports, setup, validation, external calls, transactions, and result
  mapping with logical blank lines. Do not compress unrelated statements into
  one visual block.
- Comments explain non-obvious invariants, security decisions, transaction
  boundaries, provider constraints, or deferred work. Do not narrate syntax or
  add comments that merely restate the following line.

### Frontend UI

- Treat the existing frontend file and folder structure as intentional. Follow
  the nearest established pattern and do not move, rename, flatten, or
  reorganize existing code unless the user explicitly requests it. For example,
  keep shared wrappers in the existing `components/wrappers/` directory.
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
- Use React Hook Form for frontend form state and submission. Define validation
  with an Effect `Schema` beside the form, convert it with
  `Schema.toStandardSchemaV1`, and pass it to `standardSchemaResolver` from
  `@hookform/resolvers/standard-schema`. Render fields with React Hook Form's
  `Controller` and the individual `Field`, `FieldGroup`, `FieldLabel`,
  `FieldError`, and control components from `@namera-ai/ui`. Use a native
  `<form id="..." noValidate>` with `form.handleSubmit`, and associate submit
  buttons through their `form` attribute. Spread `field` onto native inputs;
  adapt selection and controlled-value props explicitly for UIKit controls such
  as `Select`, `Switch`, and `IconPicker`. Do not duplicate the schema with
  manual parsing or validation.
- Keep route-only components beside their route or route group in a
  `-components/` directory and reserve `apps/dashboard/src/components` for UI
  shared by unrelated routes. Follow the structure already used in that area.
- Keep frontend code modular and easy to maintain. A single-file component can
  remain flat; when it genuinely needs multiple subcomponents, hooks, or
  helpers, it can be split into a folder with an `index.tsx` public entry. Do not
  restructure components preemptively for possible future complexity.
- Keep route files declarative and small. Split large screens along meaningful
  UI or workflow boundaries instead of accumulating a single large component.
- Use Motion for purposeful transitions and microinteractions, with reduced
  motion support. Use `usehooks-ts` for reusable browser interactions such as
  debouncing and stepped state instead of reimplementing generic hooks.
- In `apps/dashboard`, prefetch protected data with the router-owned Effect atom
  registry so loaders and React hooks share the same cache.
- Domain mutation hooks accept `onSuccess`, `onError`, and `onSettled` callbacks.
  Components call `mutate` and handle feedback through those callbacks instead
  of wrapping expected mutations in `try/catch`. Reserve `mutateAsync` for
  orchestration that genuinely needs a promise, such as serialized auto-save.
- Resolve mutation errors through the shared frontend feedback registry, then
  render concise toasts with a short title and an optional one-line description.
  Do not repeat generic error strings across components.

### Testing

Read [`architecture/engineering/testing.md`](architecture/engineering/testing.md)
before adding tests. Keep provider substitutes in the package that owns the
service, and compose them into boundary tests in `apps/server/tests` instead of
mocking application internals.

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
