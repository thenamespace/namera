# Audit tables

Audit records preserve typed security and administrative history. They are separate from telemetry: traces explain runtime behavior; audit rows answer who changed or used a protected resource, in which tenant, and under which correlation context.

Source: [`packages/database/src/schema/audit`](../../packages/database/src/schema/audit).

## `audit.user_events`

User-scoped events that do not require an organization context, such as authentication/session activity.

| Column           | PostgreSQL type | Required | Default | Description                                                         |
| ---------------- | --------------- | -------- | ------- | ------------------------------------------------------------------- |
| `id`             | `text`          | Yes      | UUIDv7  | Event identifier.                                                   |
| `user_id`        | `text`          | Yes      | —       | Subject user.                                                       |
| `session_id`     | `text`          | No       | `NULL`  | Related session identifier when applicable; intentionally not a FK. |
| `event`          | `text`          | Yes      | —       | Protocol event discriminator.                                       |
| `source`         | `text`          | Yes      | —       | Origin channel/runtime.                                             |
| `data`           | `jsonb`         | Yes      | —       | Event-discriminated bounded context.                                |
| `correlation_id` | `text`          | Yes      | —       | Workflow correlation identifier.                                    |
| `request_id`     | `text`          | No       | `NULL`  | HTTP/request correlation.                                           |
| `trace_id`       | `text`          | No       | `NULL`  | Telemetry trace correlation.                                        |
| `created_at`     | `timestamptz`   | Yes      | `now()` | Immutable event time.                                               |

### Keys and uniqueness

- Primary key: `id`.

### Foreign keys

- `user_id` → `auth.user.id`, `ON DELETE RESTRICT`.
- `session_id` is not constrained so session lifecycle/retention cannot erase audit history.

### Checks

- Event data is protocol-decoded; no explicit SQL check.

### Indexes

- (`user_id`, `created_at DESC`).
- (`user_id`, `event`, `created_at DESC`).
- (`session_id`, `created_at DESC`).
- `correlation_id`.

## `audit.organization_events`

Tenant-scoped events for mutations and protected operations.

| Column            | PostgreSQL type | Required | Default | Description                                          |
| ----------------- | --------------- | -------- | ------- | ---------------------------------------------------- |
| `id`              | `text`          | Yes      | UUIDv7  | Event identifier.                                    |
| `organization_id` | `text`          | Yes      | —       | Tenant.                                              |
| `actor_id`        | `text`          | No       | `NULL`  | Responsible actor; null for trusted system activity. |
| `event`           | `text`          | Yes      | —       | Protocol event discriminator.                        |
| `source`          | `text`          | Yes      | —       | API, dashboard, worker, or other origin.             |
| `resource_type`   | `text`          | No       | `NULL`  | Associated resource kind.                            |
| `resource_id`     | `text`          | No       | `NULL`  | Associated resource ID.                              |
| `data`            | `jsonb`         | Yes      | —       | Event-discriminated bounded context.                 |
| `correlation_id`  | `text`          | Yes      | —       | Workflow correlation identifier.                     |
| `request_id`      | `text`          | No       | `NULL`  | Request correlation.                                 |
| `trace_id`        | `text`          | No       | `NULL`  | Telemetry trace correlation.                         |
| `created_at`      | `timestamptz`   | Yes      | `now()` | Immutable event time.                                |

### Keys and uniqueness

- Primary key: `id`.

### Foreign keys

- `organization_id` → `auth.organization.id`, `ON DELETE RESTRICT`.
- (`actor_id`, `organization_id`) → `auth.actor`, `ON DELETE RESTRICT`.

### Checks

- Resource pair: `resource_type` and `resource_id` are both null or both present.

### Indexes

- (`organization_id`, `created_at DESC`).
- (`organization_id`, `event`, `created_at DESC`).
- (`organization_id`, `actor_id`, `created_at DESC`).
- (`organization_id`, `resource_type`, `resource_id`, `created_at DESC`).
- `correlation_id`.

## Write invariant

When a successful state mutation requires an audit event, the domain rows and audit row share one database transaction. Audit should never claim a mutation committed when it did not, or omit the actor from a committed security change.

## Pending before production

- Define event-specific retention and export requirements.
- Add privileged audit search/export endpoints and record their own audit access.
- Decide whether cryptographic append/tamper evidence is required for enterprise plans.
- Review every mutation for transactional audit coverage and document intentional omissions.

## Waitlist operator events

`audit.waitlist_events` is append-only: text UUIDv7 primary key `id`, non-null
`waitlist_id` referencing `auth.waitlist.id`, non-null `previous_status` and
`status`, and timezone-aware `created_at` defaulting to now. A check requires
both statuses to be pending/completed and different. `waitlist_id` is indexed.
The foreign key retains history without cascading deletion. Events and status
changes share one transaction; no-op updates add nothing. No email, credential,
or invented tenant actor is stored. The shared admin token cannot attribute
actions to individual operators.

# Beta invite operator events

`audit.beta_invite_events` is append-only: text primary key `id`, non-null
`invite_id` (FK to auth.beta_invite), non-null `event` (`created`, `revoked`,
`redeemed`), and timezone-aware `created_at` defaulting to now. Operator actions
have no tenant actor. State transitions and events share a transaction; neither
codes nor the shared operator token are recorded. The invite's redeemed user
provides identity for signup events.
