# @namera-ai/database

PostgreSQL persistence for Namera using Drizzle ORM and Effect SQL. It owns the
database schema, relations, connection layer, transaction context, and typed
repositories.

## Structure

- `src/config.ts` — PostgreSQL Effect configuration.
- `src/schema/` — Drizzle tables, constraints, and indexes.
- `src/relations/` — Drizzle relation definitions.
- `src/core/layer.ts` — PostgreSQL client and `Database` service.
- `src/core/transaction.ts` — transaction context and `TransactionService`.
- `src/repositories/` — class-based repository services and aggregate layer.
- `src/testing/` — PGlite test database layer and reset service.
- `src/migrations/` — startup migrator and canonical system-role data.
- `drizzle.config.ts` — Drizzle Kit configuration.
- `migrations/` — generated migrations when present.

## Environment

| Variable            | Required                   |
| ------------------- | -------------------------- |
| `POSTGRES_DATABASE` | Yes                        |
| `POSTGRES_HOST`     | Yes                        |
| `POSTGRES_PORT`     | Yes                        |
| `POSTGRES_USERNAME` | Yes                        |
| `POSTGRES_PASSWORD` | Yes; loaded as `Redacted`. |

## Layers

```ts
import { Effect, Layer } from "effect";
import { Database, Repository, TransactionService } from "@namera-ai/database";

const PersistenceLive = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provide(Database.layer),
);
```

Repository methods call `transactionOrDatabase`. Outside a transaction they use
the normal database; inside `TransactionService.run` they automatically use the
same typed Drizzle transaction client.

```ts
const createUserAndSession = Effect.gen(function* () {
  const repositories = yield* Repository;
  const transactions = yield* TransactionService;

  return yield* transactions.run(
    Effect.gen(function* () {
      const user = yield* repositories.auth.user.create(userInput);
      const session = yield* repositories.auth.session.create(sessionInput(user.id));
      return { user, session };
    }),
  );
});
```

## Commands

```sh
pnpm dev:services:up
pnpm --filter @namera-ai/database db:generate
pnpm --filter @namera-ai/database db:migrate
pnpm --filter @namera-ai/database db:studio
```

Change tables and protocol models together. Business workflows belong in
`@namera-ai/application`, not repositories.

## Adding persistence

1. Update the protocol persistence model and Drizzle table together.
2. Use database constraints for invariants that must hold for every caller:
   uniqueness, foreign keys, tenant scope, canonical values, and atomic state
   transitions. Keep project-owned literal unions as `text(...).$type<>()`; do
   not add PostgreSQL enums.
3. Add indexes for actual lookup and ordering patterns. Organization-owned
   references should include organization scope where cross-tenant linkage must
   be impossible.
4. Update `relations`, generate and inspect the migration, and keep PGlite reset
   order aligned with foreign keys.
5. Add focused repository methods using `transactionOrDatabase`. Encode inputs
   and decode returned rows with the protocol schema.
6. Export the repository through the existing aggregate. Do not expose raw
   Drizzle clients or accept transaction clients in repository APIs.

Repositories perform persistence only. Cross-repository decisions, audit
selection, provider calls, logs, and metrics belong in `application`.

`DatabaseMigration.layer` applies pending Drizzle migrations and upserts the
canonical owner, admin, and member roles. The server waits for this layer before
opening its HTTP port. The upsert preserves system-role IDs while replacing
metadata and permission arrays with their code-owned definitions.

For a multi-service deployment, run the same migrator as a release job instead
of making every service migrate. The migrator also takes a PostgreSQL advisory
lock so concurrent server starts serialize safely.

`TestDatabase.layer` creates an in-memory PGlite database, applies the real
Drizzle migrations, seeds system roles, and exposes a reset operation for
integration-test isolation.

## Organization persistence

- Organizations are addressed by ID. They do not have slugs; the authenticated
  session stores the currently selected organization ID.
- Selecting an active organization succeeds only when the session user has an
  active membership. Authorization must recheck that membership on requests.
- An organization role is either a reference to a global system role or a custom
  role with local key, metadata, and permissions. System-role values are resolved
  from `system_role` and are not duplicated in `organization_role`.
- Membership and invitation state transitions are organization-scoped and
  conditional. Compose multi-record operations with `TransactionService`.

## Audit persistence

The `audit` schema contains append-only `user_events` and
`organization_events`. Drizzle stores their event payloads as JSONB while the
protocol package defines the exact versioned `event` and `data` unions.
Organization events use a composite actor/organization foreign key so an event
cannot be attributed to an actor from another tenant. Audit tables intentionally
have no `updated_at`; the user and organization audit repositories expose only
append and newest-first history reads.
