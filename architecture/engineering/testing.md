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

Managed-wallet compatibility fixtures invoke the internal application directly:
the beta HTTP create route rejects managed custody. A dedicated route regression
covers that rejection without changing wallet, billing, or audit state; passkey
creation tests continue to use the public ceremony and create routes.

Organize suites by boundary within their owning package: `tests/unit/` for pure
domain rules, `tests/integration/` for real service/persistence/HTTP boundaries,
and `tests/e2e/` for packaged or browser journeys. Keep feature folders within
these groups and shared fixture code in `tests/fixtures/`. Contract tests that
require Anvil belong under integration and remain opt-in. Existing suites use
these boundaries; do not delete security regressions merely to reduce
the test count. Remove tests only when they duplicate behavior already covered
at the appropriate boundary or test code that no longer exists.

Vitest must resolve workspace dependencies using the `namera-source` condition
in both normal and SSR resolution. Inline workspace packages where needed; a
test must not silently validate stale `dist` files after a schema change.

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

### Disposable PostgreSQL lane

Set `NAMERA_TEST_POSTGRES_PORT` to run the server suites through `Database.layer`
and the production advisory-locked migrator instead of PGlite. The test layer
always targets `127.0.0.1`, database `namera_test`, user `postgres`, with no
password; port 5432 is rejected. Use a dedicated trust-authenticated container,
never an existing database: each test deletes its contents. Test files run
serially in this mode; do not run multiple test commands against the same port.

```sh
docker run --detach --rm --name namera-billing-concurrency-test \
  --publish 127.0.0.1::5432 --env POSTGRES_DB=namera_test \
  --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine
docker port namera-billing-concurrency-test 5432/tcp
# Substitute the assigned port below after pg_isready succeeds.
docker exec namera-billing-concurrency-test pg_isready -U postgres -d namera_test
NAMERA_TEST_POSTGRES_PORT=<assigned-port> pnpm --filter @namera-ai/server test
docker stop namera-billing-concurrency-test
```

The billing concurrency suite runs only in this lane. It exercises eight-way
meter admission, idempotent reservation/settlement, release after settlement,
and anniversary rollover against real PostgreSQL transactions. Provider calls
remain deterministic substitutes; this lane does not verify live bundlers.

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

Session-key, API-key, and OAuth grant suites create passkey wallets and register
local public signers. Grant setup runs the owner-approval HTTP routes, verifies
a real WebAuthn assertion, and invokes one reconciliation iteration against the
package-owned receipt substitute. It does not activate sessions by editing the
database. Registration remains pending until that receipt; revocation tests
distinguish immediate grant removal from confirmed onchain uninstallation.
This covers application/transport lifecycle behavior, not live chain enforcement.

Execution, history, and overview tests submit through prepare/complete and run
worker iterations explicitly. They cover idempotent settlement, failed-receipt
reservation release, actor-scoped reads, and pagination. Simulation assertions
compare usage after the installation baseline: installing a session is itself a
metered operation. The obsolete synchronous execute endpoint is asserted to fail
closed, not used to create test history.

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
