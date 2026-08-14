# Testing guide

Namera tests exercise public boundaries with real application code. Prefer a
small number of faithful test layers over mocks for every internal function.

## Test ownership

- Protocol tests belong in `packages/protocol` and cover meaningful schema
  validation, transformations, and public contract generation.
- Persistence tests belong in `packages/database` when they target repository,
  constraint, transaction, or migration behavior directly.
- HTTP feature tests belong in `apps/server/tests`. They use the real API
  contract, route handlers, authorization, application workflows, repositories,
  transactions, and database schema.
- Provider packages own their test implementations and focused lifecycle or
  protocol-adapter tests. Consumers compose those layers; they do not recreate
  provider fakes in every test suite.
- Browser interaction tests belong in `apps/dashboard` when UI behavior is
  implemented.

Do not duplicate application tests under both `packages/application` and
`apps/server`. Server feature tests already exercise application workflows
through their public HTTP boundary.

## Package-owned test layers

If a service needs a substitute, define it beside the service and expose a
focused test layer:

```ts
export class Provider extends Context.Service<Provider, ProviderService>()("Provider") {
  static readonly layer = /* live provider */;
  static readonly testLayer = /* deterministic substitute */;
}
```

The test layer should implement the same contract and expose only useful test
control or observations. For example:

- `EmailService.testLayer` captures typed messages in `TestEmails`.
- `EmailJobs.processOnce` deterministically claims and processes one durable
  job; use `TestEmails.failNext` and the Effect test clock for retry cases.
- `TestDatabase.layer` creates PGlite, applies real migrations, seeds system
  roles, and exposes `reset`.

Keep test-only state in an Effect service backed by `Ref`. Provide operations
such as `clear`, `latest`, or `sent`; do not export mutable arrays or module-level
state. Use the real crypto implementation with test secrets unless deterministic
crypto behavior is specifically required.

PGlite is the default for fast route and repository integration tests. Use real
PostgreSQL for behavior that depends on extensions, advisory locks, isolation,
concurrency, query plans, or driver-specific parsing.

## Server test structure

Mirror route domains and keep shared setup separate:

```text
apps/server/tests/
  auth/
    magic-link.test.ts
    rate-limit.test.ts
    session.test.ts
    user.test.ts
  organization/
    invitation.test.ts
    member.test.ts
    organization.test.ts
  helpers/
    api.ts
    auth.ts
    fixtures.ts
    organization.ts
  layers/
    auth.ts
    config.ts
    index.ts
```

- A test file covers one route group or one focused policy.
- Put valid schema values and metadata builders in `fixtures.ts`.
- Extract workflow setup only when it is reused or hides incidental setup. Good
  examples are `signIn`, `createSession`, `createOrganization`, `inviteMember`,
  and `createMember`.
- Helpers return data the test needs, including credentials for changing actors.
  They must not contain assertions about the behavior under test.
- Avoid giant scenario fixtures and one-use wrapper functions.

## Effect test pattern

Use `@effect/vitest`, compose one faithful server layer, and reset mutable test
state explicitly:

```ts
import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

layer(TestServerLayer)("organization routes", (it) => {
  it.effect("creates an organization", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("owner@example.com"));

      const organization = yield* createOrganization(client, "Acme");
      expect(organization.metadata.name).toBe("Acme");
    }),
  );
});
```

The server client is in-memory but runs the same request encoding, router,
middleware, response encoding, and client decoding as the real API. The local
`handledApi` adapter also runs Effect's pre-response phase so cookies and headers
set by handlers are observable.

## Isolation

- Call `resetTestState` at the beginning of every test.
- Never depend on test order.
- Keep Vitest execution non-concurrent while suites share PGlite state.
- In-memory rate-limit state is scoped to the test Layer, not the database
  reset. Put explicit rate-limit assertions in a dedicated suite, and split
  unrelated large suites before they consume production limits during setup.
- Use unique emails across scenarios.
- Use Effect's test clock for expiry, cooldown, and retry behavior. Do not sleep.
- Do not run the continuous email worker in route tests. Drive queued work with
  `EmailJobs.processOnce` so delivery, retry, and lease assertions are stable.

## What route tests should assert

For each endpoint, cover the cases that protect behavior rather than every
implementation branch:

- success response and persisted outcome;
- request and response schema behavior where meaningful;
- authentication and permission failures;
- tenant isolation and organization-scoped foreign keys;
- not-found, already-consumed, idempotent, and invalid-state transitions;
- security headers, cache policy, cookie flags, and cookie clearing;
- rate limits for sensitive operations.

When a route is added, update or add a domain test file and use the public typed
client. Querying repositories is appropriate only for setup or for verifying a
persistence outcome that is not exposed by the API.

## Commands

```sh
pnpm --filter @namera-ai/server test
pnpm --filter @namera-ai/server test:watch
pnpm --filter @namera-ai/server typecheck:test
pnpm --filter @namera-ai/wallet-keys test
pnpm test
pnpm typecheck:test
```

Before committing test changes, run the narrow server test and test typecheck,
then run `pnpm check` for cross-package verification.
