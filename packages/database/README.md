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

Repository methods are also the default database tracing boundary. Their mapped
database effects suppress child tracing so Drizzle and Effect SQL do not add a
`drizzle.operation` and `sql.execute` span for every statement. Keep repository
operation names meaningful; enable query-level tracing only temporarily when
investigating a specific database problem.

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
- Member role assignment and removal compare the expected current role during
  the write. They reject mutations from an Owner role and reject assignments to
  an Owner role. This prevents concurrent changes from bypassing application
  hierarchy checks and keeps the organization's single Owner outside generic
  member administration.
- Organization creation establishes the single Owner. Generic member and
  invitation workflows cannot assign, update, or remove that role. Ownership
  transfer requires a dedicated future application workflow; persistence does
  not independently enforce this business rule.

## Audit persistence

The `audit` schema contains append-only `user_events` and
`organization_events`. Drizzle stores their event payloads as JSONB while the
protocol package defines the exact versioned `event` and `data` unions.
Organization events use a composite actor/organization foreign key so an event
cannot be attributed to an actor from another tenant. Audit tables intentionally
have no `updated_at`; the user and organization audit repositories expose only
append and newest-first history reads.

## Email job persistence

The `jobs.email_jobs` table is the durable email outbox. It stores an encrypted,
provider-neutral payload, delivery state, retry availability, lease ownership,
expiry, and the eventual provider message ID. Its unique idempotency key prevents
the same business operation from creating duplicate jobs. Jobs have no user or
organization relation; recipients and template variables remain inside the
encrypted payload owned by `@namera-ai/emails`.

`EmailJobRepository.enqueue` reports whether it inserted or found an existing
idempotent job. Claims use `FOR UPDATE SKIP LOCKED`; all completion, retry, and
terminal transitions require the current lease token. Keep delivery and retry
policy in `@namera-ai/emails`, not in the repository. Pending jobs can be
canceled by idempotency key; canceled jobs are terminal and discard ciphertext.

`auth.verification` has a partial unique index on purpose and identifier for
active records. Credential replacement and conflict-safe creation ensure that
only one pending magic-link credential per normalized email can be consumed,
including under concurrent requests.

## API-key persistence

`auth.api_key` is the credential record for an organization-scoped
`auth.actor` with type `api-key`. It stores only a hash and safe starting
characters, never the raw key. Composite foreign keys keep the API-key actor,
creator, and optional revoker in the same organization. API-key authorization
continues through `core.session_key_grant`; permissions, quotas, and request
counters do not belong on the credential row.

`ApiKeyRepository` stores and reads organization-scoped credential records.
`SessionKeyGrantRepository` inserts grants in one batch and returns active grants
joined to their session keys for one actor. Credential generation, hashing,
grant validation, audit, and notifications remain application concerns.

## Notification persistence

The `notification` schema separates immutable occurrences from per-user inbox
state and preferences:

- `notifications` stores the typed event payload, optional organization and
  actor context, resource identity, correlation ID, expiry, and a unique
  business idempotency key.
- `notification_recipients` stores read/archive state for each user and may link
  one durable `jobs.email_jobs` delivery.
- `notification_preferences` stores sparse global or organization-specific
  category/topic email overrides. Partial unique indexes prevent duplicate
  global and organization overrides when `organization_id` is nullable. The
  repository decodes category/topic pairs through the protocol union so an
  invalid pair cannot cross the persistence boundary.

Resolve organization recipients in the application workflow and persist them
when the notification is created. Do not recalculate historical inbox visibility
from the user's current memberships.

## Wallet persistence

`core.wallet_key` stores the public key and opaque provider reference while
`core.wallet` stores the organization-owned address and namespace-specific
account data. The repositories expose organization-scoped wallet reads and
transaction-aware inserts. Provider calls and account construction do not
belong in repositories; `application` coordinates those capabilities before
persisting both records in one transaction.

## Session-key persistence

`core.session_key` belongs to one wallet and stores its namespace, immutable
metadata, namespace-specific typed `policies` array, and policy hash. Revocation
is a lifecycle change; policies are not updated in place. Its repository exposes
tenant-scoped insert, ID lookup, wallet listing, and organization listing.
`core.session_key_grant` links an actor to a session key within the same
organization and retains revoked grant history. A partial unique index permits
only one active grant for an actor/session-key pair. Composite foreign keys
prevent wallets, actors, session keys, grants, and executions from being linked
across organizations.

`core.session_key_policy_state` stores versioned, handler-owned JSON state for
one policy instance and state key. `core.session_key_policy_reservation` holds
bounded in-flight changes so concurrent executions cannot consume the same
allowance. Reservations are correlated by execution ID and move through
reserved, submitted, settled, or released states. Policy handlers own decoding
the JSON payloads; the database owns tenant isolation, uniqueness, and expiry
lookup indexes.

`core.execution` is an append-only record of a successful onchain execution.
It references the exact session-key grant used for authorization and stores a
namespace discriminator with typed namespace-specific JSON data. EVM execution
data contains the normalized calls, chain ID, UserOperation hash, and transaction
hash. Policy, simulation, signing, and submission failures do not create
execution rows. Reservation execution IDs therefore remain correlation values
and intentionally do not reference this table.

## Billing persistence

The `billing` schema keeps plan state separate from organization identity:

- `account` is a one-to-one organization billing record and may later link to a
  provider customer.
- `subscription` preserves plan/version history and permits only one trialing,
  active, or past-due row per organization.
- `provider_event` is an idempotent provider-webhook inbox keyed by provider and
  provider event ID.

Free subscriptions need neither provider identifiers nor artificial billing
periods. Plan limits live in the application catalog documented in
`packages/application/BILLING.md`; database rows store only the selected key and
version.

The billing repository aggregate exposes account creation/lookup/locking,
current-subscription lookup, and a usage read model. Quota-sensitive application
transactions lock `billing.account` before reading usage so concurrent writes for
one organization are serialized without globally locking other organizations.
