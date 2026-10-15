# Namera repository guide

Namera is a programmable wallet backend. Agents can execute onchain operations
within permissions defined by users and organizations. This repository is a
pnpm/Turborepo TypeScript monorepo targeting Node.js 24 and using Effect v4.

## Working sequence

1. Inspect the branch, working tree, and recent commits. Preserve existing work
   and keep unrelated changes in separate commits.
2. Read the owning package README and relevant architecture document, then trace
   the implementation and its callers. When documentation disagrees with code,
   verify the behavior in source and tests before making a change.
3. Make one coherent change at a time. Preserve public contracts and security
   boundaries unless the request explicitly changes them.
4. Run focused checks and existing regression tests. Run `pnpm check` for
   cross-package changes; report skipped checks and existing failures accurately.
5. Inspect the diff, including generated files, then commit with a short
   Conventional Commit message. Do not include local research or temporary files.

Do not send live transactions, rotate credentials, change production data, or
rewrite Git history as a side effect of a refactor.

## Readability and module design

- Keep each module responsible for one domain or workflow. Split substantial
  screens into rendering, state, and domain sections when those boundaries are
  useful; do not split files just to meet a line count. Roughly 300–500 lines is
  a review prompt, not a hard limit. Schemas and declarative data can be larger.
- Reuse a helper when it has multiple callers, represents a domain invariant,
  or makes a workflow materially clearer. Keep simple one-off logic inline.
- Construct expected errors where the failure is detected. Avoid tiny `fail`
  wrappers that only hide an error constructor. Keep real error translation at
  provider and transport boundaries, and preserve public result APIs.
- Use names that explain the domain. Avoid catch-all `helpers.ts`, `common.ts`,
  or new utility layers when a focused module name describes the responsibility.
- Separate setup, validation, external calls, transactions, and result mapping
  with logical blank lines. Comments explain constraints and reasoning, not syntax.
- Preserve explicit authority checks around external operations. Sharing a
  credential loader must not cache credentials or remove fresh revocation checks.
- Remove obsolete runtime jobs and their callers after retirement is confirmed.
  Do not delete historical database migrations just because they already ran.
- Keep dependencies in the package that imports them. Prefer existing platform
  APIs and dependencies over adding another library for a small abstraction.

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
- [`apps/admin-portal`](apps/admin-portal/README.md) — static TanStack Router SPA
  with Google/email sign-in, overview, team, invite-code, and waitlist management.
  Uses verified user sessions and platform membership.
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
- [`packages/wallet-providers/gcp`](packages/wallet-providers/gcp/README.md) — Google Cloud KMS lifecycle and signing through `GcpService`.
- [`packages/wallet-providers/local`](packages/wallet-providers/local/README.md) — development filesystem keys through `LocalService`.
- [`packages/wallet-providers/oneclaw`](packages/wallet-providers/oneclaw/README.md) — SDK-backed Platform/customer/agent operations through `OneClawService`, plus org OIDC issuance. Application workflows coordinate managed wallet and session signing.
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
- [`packages/recipes`](packages/recipes/README.md) — private, browser-safe policy
  recipe definitions, input schemas and deterministic session builders.

Read the relevant package README before changing that package.
Publishable package READMEs (`api`, `protocol`, `sdk`, and `cli`) are for npm users,
not internal contributors. Start with a clear description and requirements,
include npm/pnpm/yarn/bun installation commands, then runnable quick-start and
practical usage examples. Explain authentication, configuration, and important
safety limits where relevant. Use absolute documentation links that work on npm.
Keep internal folder inventories and contributor rules in `architecture/` or
this guide instead of applying the private-package README template. Verify code
examples against current public exports and keep them synchronized with releases.

Read the relevant feature document in [`architecture/`](architecture/README.md)
before changing a cross-package flow. Read
[`architecture/runtime/observability.md`](architecture/runtime/observability.md)
before adding or changing traces, logs, metrics, or browser OTLP behavior.

## Public docs writing style

Apply these conventions to `apps/web/content/docs`. Use the SDK Overview,
Installation, and Getting Started pages as the reference structure.

- Write for humans first, with explicit names and context that also help AI
  agents. Use short sentences, direct instructions, and only the information
  needed for the current task. Avoid filler, implementation trivia, repeated
  caveats, and explanations of obvious language features.
- Keep Overview brief: explain what the integration does, then show practical
  examples one after another under H3 headings. Do not put different tasks in tabs.
- Keep Installation focused on requirements and install commands. A short page
  is fine; do not pad it with import checks or redundant setup explanations.
- Order Getting Started as installation, account/session setup in the dashboard,
  client creation, listing accounts, listing session keys, executing a transaction,
  and checking submission status. Use ordinary H2/H3 headings, not numbered
  Fumadocs Steps wrappers. Short ordered lists within setup sections are fine.
- Use Fumadocs components when they help: package-manager tabs and semantically
  colored info/warning callouts. Keep essential prerequisites and safety notes
  close to the action; do not turn every paragraph into a callout.
- Use `index.ts` for simple examples. Include helper imports in the snippet
  where they are used. Prefer readable helpers such as `parseEther("0.001")`
  over raw wei literals, and include imported packages in installation commands.
- Keep examples short without making them incorrect. Avoid repeated environment
  guards and elaborate scaffolding; retain error handling needed to use results
  safely. Log the complete result `.data` rather than the SDK envelope or mapped fields.
- Keep secrets such as API keys in environment variables. Put clearly labeled
  example recipients and nonsecret values in code. Select returned session keys
  directly when appropriate, and state the setup assumptions instead of silently
  choosing an arbitrary key with different permissions.
- Show JSON responses inline in fixed-height, scrollable code blocks using the
  `docs-response` wrapper. Do not hide them in accordions or add Show more controls.
  Omit response-block titles. Verify examples against current SDK exports and API
  schemas. Show complete data shapes with illustrative values, without omitting
  fields or adding shortened-response notes; never invent response fields.
- Keep amounts, networks, variable names, and permissions consistent across
  prose and snippets. Distinguish submission from confirmation where relevant.
- Write finished documentation, not preview filler. Do not describe unsupported
  functionality as available; omit it or state the actual limitation concisely.

### Guides and reference pages

- Guides teach one task: state the outcome and prerequisites, then show the
  working code and full response in task order. Explain decisions that affect
  the outcome and link to reference for exhaustive parameter details. Use plain
  headings, not Steps wrappers, and do not hide separate tasks in tabs.
- Reference pages document one constructor or method. Follow this order:
  method name and purpose, Usage, Returns, Parameters, then relevant behavior
  and errors. Use viem-style prose sections, not TypeTable components.
- Usage examples show `index.ts` and `client.ts` as two file tabs for the same
  example. Export the authenticated client from `client.ts`; import it in
  `index.ts`. File tabs are not tabs for unrelated tasks. Include all helper
  imports and identify additional dependencies such as viem.
- Give each parameter an H3 heading using its exact SDK name, a type, required
  or conditional status, and its default when one exists. Explain what it does,
  where its value comes from, constraints, and omission behavior. Avoid one-word
  descriptions. Add a working method-call example with the relevant lines
  focused using `[!code focus]`; do not imply that a code fragment is a complete
  script or silently depend on variables from another example.
- Use H4 sections for nested parameter fields. Distinguish identifiers from
  addresses and hashes, wei from token units, and CAIP-2 IDs from numeric chain
  IDs. Document discriminated payloads and conditional return fields explicitly.
- Returns describes the successful SDK data and includes complete illustrative
  JSON without a response-block title. Explain the result envelope and decoded
  date-time/bigint representation once through the shared result snippet.
- Reuse genuinely repeated Markdown through Fumadocs `<include>` snippets in
  `apps/web/content/snippets/sdk/`, outside the routed docs collection. Keep
  method-specific examples in the page. Includes must appear in rendered pages,
  headings, search, and processed Markdown; never replace readable content with
  an opaque runtime-only component.
- Typecheck both usage files and parameter examples against SDK source. Validate
  JSON examples against protocol response schemas. Check Markdown exports and
  internal links, not just the visual page. Do not send live transactions to
  verify documentation examples.

### CLI documentation

- Keep Introduction, Essentials, Guides, and Reference aligned with the SDK
  navigation. Guides teach tasks; reference titles use exact command names.
- Reference order is Usage, Output, Arguments, Options, then relevant behavior
  and errors. Explain flag types, defaults, required conditions, and interactions.
- Capture output from the actual CLI or its production formatters with
  schema-validated fixtures. Label fixture values, preserve complete JSON, and
  distinguish stdout, stderr, and exit status. Never run live transactions to
  produce documentation examples.
- Verify shell examples and flags against current commands. Explain wei units,
  non-interactive requirements, profile/host precedence, and separate MCP login
  where relevant. Do not imply SDK-only options exist in the CLI.

### MCP documentation

- Keep MCP docs setup-focused: Introduction, Essentials, and client connection
  guides. Do not add transaction/signing walkthroughs or a tool reference;
  agents discover the tool schemas themselves.
- Each client guide covers prerequisites, its exact registration command or
  config format, authorization with a matching profile, a read-only first
  request, and disconnection. Cite the client's official setup documentation.
- Verify each client's transport, config wrapper, location, and approval
  behavior. Do not copy one client's JSON format into all clients. Distinguish
  documented setup from a connection actually tested in that application.
- Be explicit when a URL-only client cannot use the local stdio server. Never
  invent a hosted MCP endpoint or present an unauthenticated bridge as setup.
- Reuse common instructions in `apps/web/content/snippets/mcp/`. Keep
  client-specific configuration and profile commands in each page.

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
apps/server      -> api, application, crypto, database, emails, telemetry, evm, wallet-providers/*
application      -> crypto, database, emails, evm, passkeys, telemetry, protocol, utils, wallet-providers/*
api              -> protocol
crypto           -> protocol, utils
database         -> protocol, utils
emails           -> crypto, database, telemetry, protocol
evm              -> protocol
wallet-providers/*      -> protocol
passkeys         -> utils
apps/dashboard   -> api, protocol, recipes, telemetry, ui
recipes          -> protocol
apps/admin-portal -> api, protocol, ui
email-templates  -> emails, protocol, ui (preview and build-time asset generation only)
ui               -> protocol, Namespace UIKit
```

Additional rules:

- `api` may depend on `protocol`; it must not contain handlers or business logic.
- `crypto`, `database`, `evm`, and `wallet-providers/*` may depend on `protocol`; they
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
- Wallet provider clients and private key material stay inside their independent
  `packages/wallet-providers/*` packages. Application workflows use explicit
  provider services such as `GcpService` and `LocalService`; do not introduce a
  shared provider interface or dispatcher. EVM receives signing callbacks only.
- Application wallet workflows coordinate billing, key providers, chain
  adapters, persistence, audit events, notifications, and email enqueueing.
  Remote key/account creation happens before the final transaction; repeat the
  locked billing check inside that transaction before persisting the resource.
- Chain adapters such as `evm` own chain metadata, clients, account construction,
  execution, and chain-specific policy evaluation. They must not depend on
  `application` or `apps/server`.
- `apps/server` is the composition root. It provides Node/runtime layers,
  implements API handlers and authorization, and reads deployment environment.
- `apps/admin-portal` is a static SPA with no backend of its own. It holds no
  database credentials and never touches `database`, `application`, or any
  repository: every read and write goes over HTTP to `apps/server`'s `/internal`
  API, typed through `api`. New portal code must use the existing HttpOnly user
  session and platform membership, not the retired shared admin token.
- Every `/internal` route is operator surface: it carries `AdminAuthorization`
  and `OpenApi.Exclude`, so it stays out of the published spec and the Scalar
  reference. `tests/integration/transport/openapi-internal.test.ts` enforces it.

## Adding namespaces and custody providers

- Add namespace-discriminated contracts in `protocol`, then implement the chain
  adapter and application flow. Keep chain-specific encoding, policies, and
  signing semantics out of HTTP handlers and shared UI.
- Give each custody provider its own package and explicit service. Reuse domain
  checks within that provider's application workflows; do not introduce a generic
  dispatcher that hides provider-specific approval or credential requirements.
- Pass signing callbacks to chain adapters. Never move provider credentials or
  private key material into adapters, public responses, or browser code.
- Trace preparation, approval, submission, reconciliation, and cancellation
  separately. Preserve reservations and uncertainty handling; a missing receipt
  is not proof of failure and must not trigger an automatic rebroadcast.
- Extend supported exports and capabilities deliberately. A schema variant alone
  does not make a namespace, signing method, or policy available.

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

- Put presentation reused by dashboard and admin in `@namera-ai/ui`. Keep router
  links, query hooks, permissions, mutation state, and toast wording in the app.
  Reuse shared metadata/status displays, copy controls, and sign-in code input
  rather than maintaining app-specific copies. Share styling without merging
  workflows that have different authorization or lifecycle rules.
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

Use Effect Vitest for Effect workflows and ordinary Vitest for pure or public
Promise APIs. Keep fixtures typed, clocks deterministic, and cleanup scoped to
resource acquisition. Assert the intended error and durable side effects; a
generic failure can hide an invalid fixture or missing authentication.

Run dashboard rendered-control and hook tests through `test:browser`. Run server
and repository PostgreSQL suites sequentially against a disposable test database.
Keep compile-only public API assertions in the test typecheck lane. Do not remove
distinct authority, custody, race, or uncertainty cases merely to reduce test count.

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
