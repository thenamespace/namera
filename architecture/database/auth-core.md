# Auth core tables

These tables model reusable identity and credential primitives. Magic-link authentication is one consumer of `auth.verification`; the table is intentionally purpose-discriminated so future email change, step-up, recovery, and ownership challenges can reuse the same lifecycle safely.

Source: [`packages/database/src/schema/auth/core`](../../packages/database/src/schema/auth/core).

## `auth.user`

Canonical human identity. Organization membership and actors are separate so a user can belong to multiple organizations without mixing personal and tenant state.

| Column           | PostgreSQL type | Required | Default | Description                                             |
| ---------------- | --------------- | -------- | ------- | ------------------------------------------------------- |
| `id`             | `text`          | Yes      | UUIDv7  | Primary user identifier.                                |
| `email`          | `text`          | Yes      | —       | Normalized login and contact email.                     |
| `email_verified` | `boolean`       | Yes      | `false` | Whether an accepted verification flow proved the email. |
| `metadata`       | `jsonb`         | Yes      | —       | Protocol-defined user profile metadata.                 |
| `last_login_at`  | `timestamptz`   | No       | `NULL`  | Last successful login time.                             |
| `created_at`     | `timestamptz`   | Yes      | `now()` | Creation time.                                          |
| `updated_at`     | `timestamptz`   | Yes      | `now()` | Last application update time.                           |

### Keys and uniqueness

- Primary key: `id`.
- Unique constraint: `email`.

### Foreign keys

- None.

### Checks

- `user_email_normalized_check`: `email = lower(btrim(email))`.

### Indexes

- The primary-key and unique-email indexes created by PostgreSQL.

## `auth.account`

Reserved external-provider account binding. It is not the programmable-wallet `core.wallet` table and is not currently the primary Namera login path.

| Column                     | PostgreSQL type | Required | Default | Description                                                                 |
| -------------------------- | --------------- | -------- | ------- | --------------------------------------------------------------------------- |
| `id`                       | `text`          | Yes      | UUIDv7  | Binding identifier.                                                         |
| `user_id`                  | `text`          | Yes      | —       | Owning Namera user.                                                         |
| `account_id`               | `text`          | Yes      | —       | Provider-side subject/account identifier.                                   |
| `provider_id`              | `text`          | Yes      | —       | Authentication provider identifier.                                         |
| `access_token`             | `text`          | No       | `NULL`  | Provider access token if this adapter persists one.                         |
| `refresh_token`            | `text`          | No       | `NULL`  | Provider refresh token.                                                     |
| `id_token`                 | `text`          | No       | `NULL`  | Provider ID token.                                                          |
| `access_token_expires_at`  | `timestamptz`   | No       | `NULL`  | Access-token expiry.                                                        |
| `refresh_token_expires_at` | `timestamptz`   | No       | `NULL`  | Refresh-token expiry.                                                       |
| `scope`                    | `text`          | No       | `NULL`  | Provider-granted scope string.                                              |
| `password`                 | `text`          | No       | `NULL`  | Password-derived credential field for compatible adapters; never plaintext. |
| `last_used_at`             | `timestamptz`   | No       | `NULL`  | Last provider-account use.                                                  |
| `created_at`               | `timestamptz`   | Yes      | `now()` | Creation time.                                                              |
| `updated_at`               | `timestamptz`   | Yes      | `now()` | Last update time.                                                           |

### Keys and uniqueness

- Primary key: `id`.
- Unique index `account_provider_account_uidx`: (`provider_id`, `account_id`).

### Foreign keys

- `user_id` → `auth.user.id`, `ON DELETE CASCADE`.

### Checks

- None beyond column nullability.

### Indexes

- `account_user_id_idx` on `user_id`.
- `account_provider_user_idx` on (`provider_id`, `user_id`).

## `auth.verification`

Reusable, single-use verification challenge. `purpose` and typed `data`
determine the workflow. Magic links store only non-reversible credential
digests; passkey registration stores its public challenge and tenant binding in
`data`.

| Column        | PostgreSQL type | Required | Default | Description                                                  |
| ------------- | --------------- | -------- | ------- | ------------------------------------------------------------ |
| `id`          | `text`          | Yes      | UUIDv7  | Challenge identifier.                                        |
| `purpose`     | `text`          | Yes      | —       | Protocol `VerificationPurpose` discriminator.                |
| `identifier`  | `text`          | Yes      | —       | Normalized purpose-specific identity or tenant/user tuple.   |
| `data`        | `jsonb`         | Yes      | —       | Purpose-discriminated challenge context.                     |
| `token_hash`  | `text`          | No       | `NULL`  | Magic-link high-entropy token digest.                        |
| `code_hmac`   | `text`          | No       | `NULL`  | Magic-link short-code keyed digest.                          |
| `attempts`    | `integer`       | Yes      | `0`     | Failed/consumed code-attempt counter used for abuse control. |
| `expires_at`  | `timestamptz`   | Yes      | —       | Hard challenge expiry.                                       |
| `consumed_at` | `timestamptz`   | No       | `NULL`  | Successful single-use consumption time.                      |
| `revoked_at`  | `timestamptz`   | No       | `NULL`  | Administrative or replacement revocation time.               |
| `created_at`  | `timestamptz`   | Yes      | `now()` | Creation time.                                               |
| `updated_at`  | `timestamptz`   | Yes      | `now()` | Last lifecycle update.                                       |

### Keys and uniqueness

- Primary key: `id`.
- Unique index on `token_hash` prevents two challenges sharing a link credential.
- Partial unique index on (`purpose`, `identifier`) while `consumed_at IS NULL AND revoked_at IS NULL` permits only one live challenge per purpose and identity.

### Foreign keys

- None. The challenged identity may not yet have a user row.

### Checks

- Identifier normalization: `identifier = lower(btrim(identifier))`.
- Attempt count: `attempts >= 0`.
- `magic-link-signin` requires `token_hash` and `code_hmac`.
- `beta-admission` requires `token_hash` and a null `code_hmac`; its identifier
  is the verified email and its data preserves the approved return destination.
  Its ten-minute, five-attempt proof grants no ordinary session authority.
- `passkey-registration` requires both magic-link credential columns to be null.

### Indexes

- Lookup index on (`purpose`, `identifier`).
- Expiry index on `expires_at` for cleanup and expiry scans.

### Security invariants

- Raw magic-link token and code values never enter the database.
- Passkey challenge data is public but is bound to the exact RP ID, origin,
  organization, and user that must be checked when the ceremony completes.
- Consumption must atomically enforce live status, expiry, and attempt policy.
- A new challenge supersedes or conflicts with an existing live challenge for the same purpose and identifier.

## `auth.session`

Opaque browser session. The cookie contains raw credential material; the database stores only `token_hash`.

| Column                   | PostgreSQL type | Required | Default | Description                                       |
| ------------------------ | --------------- | -------- | ------- | ------------------------------------------------- |
| `id`                     | `text`          | Yes      | UUIDv7  | Session identifier.                               |
| `user_id`                | `text`          | Yes      | —       | Authenticated user.                               |
| `token_hash`             | `text`          | Yes      | —       | Digest of the opaque cookie token.                |
| `active_organization_id` | `text`          | No       | `NULL`  | Dashboard organization selected for this session. |
| `ip_address`             | `text`          | No       | `NULL`  | Captured client address for security context.     |
| `user_agent`             | `text`          | No       | `NULL`  | Captured browser agent string.                    |
| `expires_at`             | `timestamptz`   | Yes      | —       | Absolute session expiry.                          |
| `revoked_at`             | `timestamptz`   | No       | `NULL`  | Explicit invalidation time.                       |
| `created_at`             | `timestamptz`   | Yes      | `now()` | Creation time.                                    |
| `updated_at`             | `timestamptz`   | Yes      | `now()` | Last update time.                                 |

### Keys and uniqueness

- Primary key: `id`.
- Unique index on `token_hash`.

### Foreign keys

- `user_id` → `auth.user.id`, `ON DELETE CASCADE`.
- `active_organization_id` → `auth.organization.id`, `ON DELETE SET NULL`.

### Checks

- None beyond column nullability. Live-session validity is `revoked_at IS NULL` and `expires_at > now()` in repository/application logic.

### Indexes

- (`user_id`, `expires_at`) for session validation and cleanup.
- Partial (`user_id`, `created_at DESC`) where `revoked_at IS NULL` for active-session listings.
- `active_organization_id` for organization-impact queries.
- `expires_at` for expiry cleanup.

## `auth.api_key`

Organization credential for programmatic API access. The raw secret is returned only at creation; requests resolve `key_hash` to the dedicated `api-key` actor.

| Column                | PostgreSQL type | Required | Default | Description                                      |
| --------------------- | --------------- | -------- | ------- | ------------------------------------------------ |
| `id`                  | `text`          | Yes      | UUIDv7  | API-key record identifier.                       |
| `organization_id`     | `text`          | Yes      | —       | Tenant boundary.                                 |
| `actor_id`            | `text`          | Yes      | —       | Dedicated actor used by authorization and audit. |
| `created_by_actor_id` | `text`          | Yes      | —       | Actor that created the credential.               |
| `metadata`            | `jsonb`         | Yes      | —       | Human-readable name and key metadata.            |
| `key_hash`            | `text`          | Yes      | —       | Non-reversible digest of the raw API key.        |
| `key_start`           | `text`          | Yes      | —       | Safe prefix shown in lists and audit views.      |
| `expires_at`          | `timestamptz`   | No       | `NULL`  | Optional absolute expiry.                        |
| `last_used_at`        | `timestamptz`   | No       | `NULL`  | Most recent successful authentication.           |
| `revoked_at`          | `timestamptz`   | No       | `NULL`  | Terminal revocation time.                        |
| `revoked_by_actor_id` | `text`          | No       | `NULL`  | Actor that revoked the credential.               |
| `created_at`          | `timestamptz`   | Yes      | `now()` | Creation time.                                   |
| `updated_at`          | `timestamptz`   | Yes      | `now()` | Last lifecycle update.                           |

### Keys and uniqueness

- Primary key: `id`.
- Unique (`id`, `organization_id`) supports tenant-safe references.
- Unique `actor_id`: one API key owns one actor.
- Unique `key_hash`: a raw credential resolves to at most one row.

### Foreign keys

- `organization_id` → `auth.organization.id`, `ON DELETE RESTRICT`.
- (`actor_id`, `organization_id`) → `auth.actor`, `ON DELETE RESTRICT`.
- (`created_by_actor_id`, `organization_id`) → `auth.actor`, `ON DELETE RESTRICT`.
- (`revoked_by_actor_id`, `organization_id`) → `auth.actor`, `ON DELETE RESTRICT`.

### Checks

- Live authentication requires `revoked_at IS NULL` and a null or future `expires_at`; this is enforced in credential resolution rather than an SQL check.

### Indexes

- (`organization_id`, `created_at`) for dashboard lists.
- (`organization_id`, `last_used_at`) for credential review.

## `auth.actor`

Tenant-scoped principal used by authorization, audit, executions, signatures, and credentials. A person, API key, MCP authorization, or CLI authorization acts through an actor row.

| Column            | PostgreSQL type | Required | Default | Description                         |
| ----------------- | --------------- | -------- | ------- | ----------------------------------- |
| `id`              | `text`          | Yes      | UUIDv7  | Actor identifier.                   |
| `organization_id` | `text`          | Yes      | —       | Tenant boundary.                    |
| `type`            | `text`          | Yes      | —       | `user`, `api-key`, `mcp`, or `cli`. |
| `created_at`      | `timestamptz`   | Yes      | `now()` | Creation time.                      |
| `updated_at`      | `timestamptz`   | Yes      | `now()` | Last update time.                   |

### Keys and uniqueness

- Primary key: `id`.
- Unique constraint on (`id`, `organization_id`) supports tenant-safe composite references.

### Foreign keys

- `organization_id` → `auth.organization.id`, `ON DELETE RESTRICT`.

### Checks

- `type IN ('user', 'api-key', 'mcp', 'cli')`.

### Indexes

- (`organization_id`, `type`) for scoped actor listings and resolution.

## Pending before production

- Define retention and deletion behavior for external `auth.account` tokens before enabling provider login.
- Add a documented cleanup worker for expired and terminal verification rows.
- Define session concurrency and forced-global-logout policy.
- Review whether captured IP addresses require truncation or a shorter retention window.

## Waitlist

`auth.waitlist` stores unverified interest independently of users and tenants.
Columns: text UUIDv7 primary key `id`, non-null normalized `email`, non-null
`status` defaulting to `pending`, non-null timezone-aware `created_at` and
`updated_at` defaulting to now, and nullable timezone-aware `completed_at`.
The email has a unique index and a lowercase/trimmed check. Checks limit status
to `pending`/`completed` and require completion time exactly when completed.
The primary key supports descending-ID cursor scans; `(status, id)` supports
filtered pages. Literal email substring search is a scan initially. There are
no user/organization foreign keys. See [workflow](../auth/waitlist.md).

# Beta invite admission

`auth.beta_invite`: text primary key `id`, unique non-null `code_hmac`, nullable
normalized `email`, non-null `created_at` (default now) and `expires_at`, nullable
`redeemed_at`, `redeemed_by` (FK to auth.user), and `revoked_at`. All timestamps
are timezone-aware. Checks require expiry after creation, paired redemption
time/user, and mutually exclusive redeemed/revoked state. HMAC uniqueness retains
all historical codes. Reads use the HMAC index or primary key; redemption uses
row locks and conditional updates. Magic-link verification JSON can contain
`betaInviteId`; this is resolved and checked at verified signup, never trusted
as proof of admission by itself.
