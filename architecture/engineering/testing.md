# Testing

Tests exercise production boundaries with real code and package-owned substitutes.
They do not replace live provider, browser hardware, or chain verification.

## Ownership

| Boundary                 | Location                               | Approach                                                |
| ------------------------ | -------------------------------------- | ------------------------------------------------------- |
| Schemas and domain rules | Owning package `tests/unit`            | Decode inputs and check meaningful behavior             |
| Persistence              | `packages/database/tests`              | Migrated database and real repositories                 |
| Provider adapters        | Provider package tests                 | Deterministic substitutes at external boundary          |
| Business and HTTP flows  | `apps/server/tests/integration`        | Real application, authorization, transactions, encoding |
| Browser logic            | Dashboard/admin tests                  | Authority, approvals, recovery, form conversions        |
| Published clients        | CLI/SDK tests and package smoke checks | Commands/exports against controlled HTTP fixtures       |

Use PostgreSQL for locking, isolation, constraints, and driver behavior. The server
test fixture defaults to migrated PGlite; CI runs the server suite against disposable
PostgreSQL, including concurrency cases.

## Composition and isolation

Server fixtures compose real application services, crypto, repositories,
authorization, and a handled HTTP API. Wallet-key and EVM providers use their
package-owned test Layers. Outbox state and provider observations are explicit
services rather than shared module globals.

Reset the database, captured provider state, and clock between tests. Do not run
concurrent suites against one disposable database. Test one worker iteration
instead of starting continuous workers. Use a test clock for expiry and retries,
not sleeps.

Stateful regression tests check the returned contract and durable effects:
tenant/actor access, replay/idempotency, lifecycle, reservations, audit, and
outbox rows. Session installation tests distinguish API registration from
receipt-confirmed onchain authority. A missing receipt must not imply failure.

Vitest uses `namera-source` in normal and SSR resolution, so tests do not
accidentally exercise stale `dist`. Dashboard tests disable local environment
loading. Public docs examples must not submit live operations.

## Test design

Use `@effect/vitest` for service workflows, scoped Layers for resources, and
`TestClock` for deadlines. Keep ordinary Vitest for pure functions and public
Promise APIs. Register file, socket, and child-process cleanup at acquisition;
await process termination rather than only sending a kill signal.

Group tests by domain under `tests/unit` or `tests/integration`. Put typed fixture
builders in `tests/fixtures`, but keep assertions in the test. Decode external
payload fixtures through their protocol schemas. Cryptographic expected values
must not be calculated solely by the implementation under test.

Name parameterized cases by the boundary they exercise. Avoid repeating costly
storage or process workflows for every protocol version when separate handshake
tests cover compatibility. Keep distinct actor, custody, and failure-state cases.
Compile-only API checks belong in the test typecheck lane, not empty runtime tests.

## Commands

```sh
pnpm test
pnpm --filter @namera-ai/server test
pnpm --filter @namera-ai/dashboard test
pnpm typecheck:test
```

Dashboard, admin portal, and website component and hook tests run separately in real Chromium with Vitest
Browser Mode and Playwright. They load the application theme and exercise React
Aria controls, transaction confirmation, autosave authority, and shared inputs.
Workflow tests substitute session, mutation, and chain-review boundaries; package
tests own real envelope validation. Unexpected fetches fail. Local environment
files are disabled.

```sh
pnpm --filter @namera-ai/dashboard exec playwright install chromium
pnpm --filter @namera-ai/dashboard test:browser
pnpm --filter @namera-ai/admin-portal test:browser
pnpm --filter @namera-ai/web test:browser
```

On Linux CI, use `playwright install --with-deps chromium` to install required
system libraries. Browser downloads are separate from Node package installation.
Failure screenshots are local `.vitest` artifacts, not committed fixtures.

Admin browser tests use real mutation hooks and a scoped atom registry with a
controlled HTTP boundary. They cover pending controls, retained drafts,
one-time invite disclosure, catalog review, and feedback list/detail invalidation.
Website tests exercise open beta signup links, click analytics, pricing Markdown,
and compiled content publication dates.
Each application has its own browser configuration so aliases resolve within the
owning app. Run browser suites sequentially on constrained developer machines.

For the PostgreSQL lane, start a dedicated disposable container:

```sh
docker run --detach --rm --name namera-test-postgres \
  --publish 127.0.0.1::5432 --env POSTGRES_DB=namera_test \
  --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine
docker port namera-test-postgres 5432/tcp
docker exec namera-test-postgres pg_isready -U postgres -d namera_test
```

Set `NAMERA_TEST_POSTGRES_PORT` to the printed host port and run the server and
database package tests sequentially. Both suites serialize files in this lane;
do not run the two packages concurrently against the same database.
The fixture targets localhost, database `namera_test`, user `postgres`, without
a password, and rejects port 5432. It deletes test data: never point it at a
shared or retained database. Stop the container when finished.

Optional CLI keyring/packaged-import tests require
`NAMERA_TEST_OS_KEYRING=1` and supported local OS facilities. EVM Anvil tests
are opt-in. Skipped environment-dependent tests are not evidence of provider
verification.

## CI

[CI](../../.github/workflows/ci.yml) is manually dispatched. Its jobs run:

- Formatting, lint, typechecks, builds, and public tarball checks.
- CLI tests separately from other package tests, with bounded concurrency.
- The complete server suite on PostgreSQL with reproducibly shuffled order.
- Repository tests on the same disposable PostgreSQL service after the server suite.
- Dashboard, admin portal, and website browser tests in a dedicated Chromium job,
  separate from Node tests.

The seed is the workflow run number. Package tests exclude the server in CI
because PostgreSQL covers it separately; local `pnpm test` includes it.
