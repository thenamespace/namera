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

## Commands

```sh
pnpm test
pnpm --filter @namera-ai/server test
pnpm --filter @namera-ai/dashboard test
pnpm typecheck:test
```

For the PostgreSQL lane, start a dedicated disposable container:

```sh
docker run --detach --rm --name namera-test-postgres \
  --publish 127.0.0.1::5432 --env POSTGRES_DB=namera_test \
  --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine
docker port namera-test-postgres 5432/tcp
docker exec namera-test-postgres pg_isready -U postgres -d namera_test
```

Set `NAMERA_TEST_POSTGRES_PORT` to the printed host port and run the server tests.
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

The seed is the workflow run number. Package tests exclude the server in CI
because PostgreSQL covers it separately; local `pnpm test` includes it.
