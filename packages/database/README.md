# @namera-ai/database

PostgreSQL persistence using Drizzle ORM and Effect SQL. This private package owns
tables, relations, migrations, transaction context and typed repositories.

## Layout

- `src/schema/` and `src/relations/` — table constraints and typed relations.
- `src/core/` — connection, error mapping and transaction context.
- `src/repositories/` — domain repositories composed by `Repository`.
- `src/migrations/` and `migrations/` — migrator, system-role seed and SQL history.
- `src/testing/` — PGlite and disposable PostgreSQL test layers.

Repositories resolve the ambient transaction through `transactionOrDatabase`.
Nested `TransactionService.run` calls join the caller's transaction. Callers do
not pass raw clients through repository APIs. Inputs and returned rows use protocol
schemas; provider calls and cross-repository decisions belong in application.

## Configuration

Set `POSTGRES_DATABASE`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USERNAME`, and
`POSTGRES_PASSWORD`. The password is loaded as a redacted value.

The server runs `DatabaseMigration.layer` before traffic or workers start. An
advisory lock serializes migrations. The migrator also synchronizes canonical
system roles while preserving their IDs.

## Development

```sh
pnpm dev:services:up
pnpm --filter @namera-ai/database db:generate
pnpm --filter @namera-ai/database db:migrate
pnpm --filter @namera-ai/database db:studio
pnpm --filter @namera-ai/database test
```

Inspect generated SQL before committing it. Preserve historical migrations.
Tests use real migrations and reset isolated databases; never point test reset
helpers at shared data.

The default test lane uses PGlite. To run every repository suite against disposable
PostgreSQL, set `NAMERA_TEST_POSTGRES_PORT` to its separate loopback port (not 5432).
The layer pins the database to `namera_test` and the user to `postgres`; it never
uses deployment database configuration. Files run serially in this lane because
each test resets shared tables. Do not run server and package PostgreSQL tests
against the same database at the same time.

See the [data reference](../../architecture/data/README.md) for table purpose
and constraints.
