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
      const user = yield* repositories.auth.user.insert(userInput);
      const session = yield* repositories.auth.session.insert(sessionInput(user.id));
      return { user, session };
    }),
  );
});
```

## Commands

```sh
pnpm --filter @namera-ai/database db:generate
pnpm --filter @namera-ai/database db:migrate
pnpm --filter @namera-ai/database db:studio
```

Change tables and protocol models together. Business workflows belong in
`@namera-ai/application`, not repositories.

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
