# Platform administration tables

These are global identities, not organization actors. All IDs are text UUIDv7;
timestamps are `timestamptz`. Behavior: [admin authorization](../auth/admin.md).

## `auth.platform_member`

| Column                     | Type / constraints                                          |
| -------------------------- | ----------------------------------------------------------- |
| `id`                       | Primary key                                                 |
| `user_id`                  | Required, unique, FK `auth.user.id`                         |
| `role`                     | Required text: owner, operator, viewer                      |
| `status`                   | Required text: active, suspended, removed; default active   |
| `created_at`, `updated_at` | Required; default now; updates explicitly change updated_at |

A partial unique index on role where owner permits at most one owner. A check
requires owner status active. Application transfer/soft removal preserves the
initialized team's owner. Users referenced by membership cannot be deleted while
security history depends on them. No grant is inferred from an email domain.

## `auth.platform_invitation`

| Column                 | Type / constraints                                         |
| ---------------------- | ---------------------------------------------------------- |
| `id`                   | Primary key                                                |
| `email`                | Required normalized lower-case trimmed email               |
| `role`                 | Required text: operator or viewer                          |
| `token_hash`           | Required, unique; purpose-separated random-token digest    |
| `invited_by_member_id` | Required FK platform_member.id, indexed                    |
| `expires_at`           | Required, greater than created_at                          |
| `accepted_at`          | Nullable                                                   |
| `accepted_by_user_id`  | Nullable FK auth.user.id; null iff accepted_at is null     |
| `revoked_at`           | Nullable; cannot coexist with accepted_at                  |
| `created_at`           | Required, default now; issuance supplies application clock |

A partial unique index on email where accepted_at/revoked_at are null allows one
pending invitation per mailbox. Resend retires even expired pending rows before
inserting a replacement. All terminal transitions are conditional. Display state
is derived from timestamps, not duplicated as a mutable status column. List DTOs
explicitly omit token_hash. Invitations have no update timestamp: transitions are
captured by their own timestamps and audit.

## `audit.platform_events`

| Column            | Type / constraints                                                 |
| ----------------- | ------------------------------------------------------------------ |
| `id`              | Primary key                                                        |
| `actor_member_id` | Nullable FK platform_member.id; null only for bootstrap            |
| `data`            | Required JSONB, protocol-owned version-1 discriminated event union |
| `created_at`      | Required, default now                                              |

Indexed by actor_member_id and created_at. Repository exposes append only, not
update/delete. Data records member role/status transitions, team invitation IDs,
ownership transfers, beta-invite issuance/revocation and waitlist status changes.
It never contains tokens, hashes, provider credentials, or arbitrary request
payloads. FKs preserve attribution after soft membership removal.
