# Testing architecture

Namera tests public boundaries with real application code and package-owned test
layers. Tests do not mock each application function independently.

## Ownership

| Test                                           | Location                  | Boundary                                                                |
| ---------------------------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| Schema and transformation                      | `packages/protocol/tests` | Public data contract.                                                   |
| Repository, constraint, transaction, migration | `packages/database/tests` | Persistence behavior.                                                   |
| Provider adapter                               | Owning provider package   | Provider-neutral contract and lifecycle.                                |
| HTTP feature                                   | `apps/server/tests`       | Typed client through routing, middleware, application, and migrated DB. |
| Browser interaction                            | `apps/dashboard`          | User-visible behavior and accessibility.                                |

Application behavior exercised through the server boundary is not duplicated in
a second application-only suite.

## Test composition

Provider packages expose deterministic test Layers beside the live service.
Test-only observations live in Effect services backed by `Ref`, not module-level
mutable arrays. The server suite composes real application workflows,
repositories, transactions, authorization, and route encoding with:

- migrated PGlite for fast integration tests;
- real project crypto with test secrets;
- deterministic wallet-key and EVM layers;
- a controlled EmailJobs processor and captured deliveries;
- an in-memory handled API that runs Effect's pre-response phase so cookies and
  headers remain observable.

Use PostgreSQL rather than PGlite for behavior depending on advisory locks,
isolation, extensions, query plans, concurrency, or driver parsing.

## Isolation rules

- Reset database and captured provider state at the start of every test.
- Never depend on test order; use unique identities per scenario.
- Keep shared-PGlite suites non-concurrent.
- Use Effect's test clock for expiry, cooldown, leases, and retries; never sleep.
- Do not run continuous workers in route tests. Invoke one deterministic worker
  iteration.
- Keep rate-limit assertions in focused suites because the in-memory store is
  scoped to the test Layer rather than the database reset.

## Required route coverage

For a stateful endpoint, cover the behavior that protects the contract:

- decoded success response and persisted result;
- authentication, actor-type, scope, and permission failures;
- tenant isolation and organization-scoped foreign keys;
- idempotency, replay, already-consumed, and invalid lifecycle transitions;
- security headers, cookie flags, no-store behavior, and rate limits where
  applicable;
- audit, notification, billing, and outbox rows that must share the mutation.

Repository queries are acceptable for setup and for outcomes not exposed by the
public API. Test helpers may assemble workflows but must not hide assertions.

## Commands

```sh
pnpm --filter @namera-ai/server test
pnpm --filter @namera-ai/server typecheck:test
pnpm --filter @namera-ai/wallet-keys test
pnpm test
pnpm typecheck:test
pnpm check
```

## Pending

- Add dashboard browser and accessibility regression tests.
- Add packaged CLI tests for macOS Keychain, Windows Credential Manager, and
  Linux Secret Service.
- Add opt-in live tests for GCP KMS, Alchemy Rundler/BSO, Resend, and Axiom.
- Rehearse migrations and concurrency-sensitive tests against the production
  PostgreSQL version.
