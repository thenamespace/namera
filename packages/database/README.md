# @namera-ai/database

PostgreSQL persistence for Namera using Drizzle ORM and Effect SQL. It owns the
database schema, relations, connection layer, transaction context, and typed
repositories.

See the [canonical database catalog](../../architecture/database/README.md) for
every table column, key, foreign key, check, and index. Runtime, migration, and
transaction conventions are in
[database architecture](../../architecture/platform/database.md).

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

Relations use Drizzle's `defineRelationsPart` API and are split by schema
domain under `src/relations`. The barrel spreads the empty schema-wide inference
part first, followed by non-overlapping auth, OAuth, audit, billing, core, jobs,
and notification parts. Define each source table in exactly one part; relations
may still target tables from any schema. Add a short comment above every
relation explaining its domain meaning, especially when the foreign-key shape
is not obvious.

Execution reconciliation claims `prepared` and `submitted` rows in bounded
batches using `FOR UPDATE SKIP LOCKED`. A shared token leases the claimed batch;
all terminal transitions verify both submission identity and lease ownership.
Unexpired `reserved` rows are never claimed; expired unsigned preparations are
leased for transactional reservation release. Signature acceptance atomically
checks actor, request hash and expiry and preserves the persisted preparation.
Synchronous execution schedules a
grace period before a prepared or submitted row becomes eligible, preventing the
worker from racing an active HTTP request.

`DatabaseMigration.layer` applies pending Drizzle migrations and upserts the
canonical owner, admin, and member roles. The server waits for this layer before
opening its HTTP port. The upsert preserves system-role IDs while replacing
metadata and permission arrays with their code-owned definitions.

For a multi-service deployment, run the same migrator as a release job instead
of making every service migrate. The migrator also takes a PostgreSQL advisory
lock so concurrent server starts serialize safely.

`TestDatabase.layer` creates an in-memory PGlite database with the bundled
`pg_trgm` extension, applies the real Drizzle migrations, seeds system roles,
and exposes a reset operation for integration-test isolation. PostgreSQL-only
locking, concurrency, and query-plan behavior still require the production
PostgreSQL test lane.

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

`ApiKeyRepository` stores, reads, and conditionally revokes organization-scoped
credential records. `SessionKeyGrantRepository` inserts grants in one batch,
returns active grants joined to their session keys for one actor, and revokes all
active grants for a revoked actor. Credential generation, hashing, grant
validation, audit, and notifications remain application concerns.

## OAuth authorization persistence

OAuth persistence lives under `auth/oauth` and separates protocol clients from
Namera authorization identities:

- `oauth_client` caches or registers public client metadata. Its `client_id` is
  the OAuth wire identifier; the branded row ID is used by internal foreign
  keys.
- `oauth_authorization_request` is the short-lived PKCE consent state. Pending
  lookup and approval/denial are conditional on expiry and current status.
- `oauth_authorization` is the durable organization consent for an `mcp` or
  `cli` actor. Tenant-scoped foreign keys bind the actor, authorizer, and
  revoker to the same organization.
- `oauth_device_authorization` stores hashed RFC 8628 device credentials,
  bounded polling state, the claimed user, and the authorization created by an
  approved CLI request. Raw device and user codes are never persisted.
- `oauth_authorization_code` stores only a code hash and is consumed atomically.
- `oauth_token` stores only access/refresh token hashes. Refresh tokens carry a
  family and optional parent so reuse can revoke a family or the complete
  authorization.

Repositories expose only focused lifecycle operations: client metadata upsert,
pending consent transitions, active authorization lookup/revocation, one-time
code consumption, active access lookup, refresh consumption, and token
revocation. OAuth verification, PKCE comparison, credential generation, actor
and grant creation, audit, and telemetry belong in the application workflow and
must share transactions where state changes are coupled.

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
account data. The repositories expose organization-scoped wallet reads,
transaction-aware inserts, and metadata-only updates. Provider calls and
account construction do not belong in repositories; `application` coordinates
those capabilities before persisting both records in one transaction.

Actor-scoped wallet reads join active grants through active session keys and
deduplicate wallets by ID. Session-key actor reads use the same active-grant
boundary. Execution actor reads use the submission's creating actor. These
queries are the machine-actor visibility boundary; do not load an organization
wide result and filter it in application memory.

## Session-key persistence

`core.session_key_operation` retains immutable owner-prepared installation and
removal attempts, signed payloads and reconciliation leases. An expired unsigned
approval can be retried; a signed attempt stays recoverable until a chain receipt
resolves it. The repository guards actor/request binding, one-time acceptance,
payload equality and lease ownership. Application approval and worker wiring
remain pending.

`core.session_key_installation` records per-chain compiled authorization and
receipt-bound installation/revocation state. The repository exposes scoped reads
and conditional transitions, not generic mutation of installed permissions.
Tenant-safe ownership and unique wallet/chain/entity constraints protect the
binding. This is a persistence foundation: session creation/approval and worker
integration remain part of the self-custody migration.

`core.session_key` belongs to one wallet and stores its namespace, immutable
metadata, namespace-specific typed `policies` array, and policy hash. Revocation
is a lifecycle change; policies are not updated in place. Its repository exposes
tenant-scoped insert, ID lookup, wallet listing, and organization listing.
`core.session_key_grant` links an actor to a session key within the same
organization and retains revoked grant history. A partial unique index permits
only one active grant for an actor/session-key pair. Composite foreign keys
prevent wallets, actors, session keys, grants, and executions from being linked
across organizations.

Session-key revocation conditionally marks one active key revoked and revokes
every active grant referencing it in the same application transaction. Existing
submission and execution references remain intact for reconciliation and
history.

`core.session_key_policy_state` stores versioned, handler-owned JSON state for
one policy instance and state key. `core.session_key_policy_reservation` holds
bounded in-flight changes so concurrent operations cannot consume the same
allowance. Each reservation references exactly one execution submission or
signature operation through tenant-scoped foreign keys. Partial unique indexes
enforce one reservation per operation, policy, and state key. Reservations move
through reserved, submitted, settled, or released states. The policy-state
repository supports exact-scope transaction row locks and revision-checked updates;
reservation lookup and terminal transitions accept a discriminated operation
reference. Policy handlers own decoding the JSON payloads; the database owns
tenant isolation, ownership constraints, uniqueness, and expiry lookup indexes.

`core.execution_submission` is mutable operational state for an actor's
idempotent execution attempt. It references the exact session-key grant,
preserves namespace-specific recovery data, and moves through reserved,
prepared, submitted, confirmed, or failed states. `core.execution` references
exactly one matching submission/grant/organization tuple and remains an
append-only record created only for a successful onchain execution. EVM
execution data contains normalized calls, chain ID, UserOperation hash, and
transaction hash.

`ExecutionSubmissionRepository` provides conflict-safe actor idempotency,
conditional lifecycle transitions, and leased reconciliation claims.
`ExecutionRepository` exposes append-only insertion and organization-scoped
reads using a stable `(created_at, id)` newest-first cursor. List reads join the
historical actor, session key, wallet, and wallet-key presentation data in one
query so activity consumers do not perform relation lookups per row. The
selection shapes and row decoders live in a focused execution-view module, so
the repository service remains centered on queries and transaction behavior. Both use
the transaction context so confirmation can atomically settle policy state and
create the successful execution.

## Billing persistence

The `billing` schema keeps plan state separate from organization identity:

- `account` is a one-to-one organization billing record and may later link to a
  provider customer.
- `subscription` preserves plan/version history and permits only one trialing,
  active, or past-due row per organization.
- `subscription_item` maps code-owned priced components to provider items.
- `period` snapshots the plan/version and time window used for metering.
- `meter_balance` stores one admission-control projection per period and meter.
- `usage_reservation` holds quota while billable work is in flight.
- `usage_event` is an append-only debit/credit usage ledger.
- `usage_delivery` is the retryable outbound provider-reporting outbox.
- `provider_event` is an idempotent provider-webhook inbox keyed by provider and
  provider event ID.

Free subscriptions need no provider identifiers or subscription items. Every
new organization receives an active Free subscription, an organization-anniversary
period, and one balance for each enabled meter so all plans share one allowance
model. Plan, component, and meter definitions live in the
code-owned catalog documented in the
[billing architecture](../../architecture/billing/README.md). Meter keys are row
dimensions; adding a supported meter does not add fixed usage columns.

The billing repository aggregate exposes account creation/lookup/locking,
current-subscription lookup, period and balance access, subscription-item
lifecycle, idempotent reservation and ledger insertion, outbound-delivery
lifecycle, provider-event inbox lifecycle, current resource counts, locked meter
transitions, ledger aggregation, expiry claims, and projection replacement. All
repository operations use the ambient transaction when present. Nested
`TransactionService.run` calls join that transaction, allowing operation,
policy, audit, and billing rows to commit atomically. Resource-sensitive
transactions lock `billing.account`; metered admission uses conditional balance
updates so concurrent operations cannot cross the hard limit. Resource reads derive usage from
domain operation rows.
