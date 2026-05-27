# Namera Database Specification

This package defines the Namera database schema with Drizzle ORM and Postgres
RLS. The matching runtime/data contracts live in `packages/schema`.

The database is designed around three boundaries:

1. User-owned auth rows: users may access only rows tied to their own user id.
2. Organization-owned rows: access is based on organization membership and role
   permissions.
3. Service/admin-owned rows: only the trusted backend/admin database role should
   create or mutate these rows.

The API is the main product authorization layer. RLS is the database safety
layer: it must prevent cross-user and cross-organization access even if an API
query is written incorrectly.

## Data Philosophy

Domain tables store current state. They should answer "what is true now?" for
users, organizations, members, roles, invitations, smart accounts, and session
keys.

Historical activity should be append-only and separate from domain tables. Future
event/inbox tables should record important mutations such as role changes,
member removals, invitation state changes, smart account changes, and session
key revocations. Domain tables should keep lifecycle fields only when they are
part of the current state, such as `deleted_at`, `removed_at`, or `revoked_at`.

App-user hard deletes are avoided for domain tables. Product delete/remove/revoke
actions should normally be implemented as API-controlled updates that set
lifecycle fields. `app_admin` may retain hard-delete capability for maintenance,
retention jobs, and exceptional repair work.

## Actors

Postgres roles used by policies:

| Role        | Purpose                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| `app_user`  | Runtime role used for authenticated user-scoped requests.                |
| `app_admin` | Trusted backend/admin role. Policies allow this role to access all rows. |

Request identity is provided through:

```sql
current_setting('app.user_id', true)
```

The helper function `auth_current_user_id()` normalizes this setting and returns
the active application user id as `text`.

## Authorization Model

Namera uses permission-based organization roles.

The core graph is:

```text
auth.user
  -> auth.member
    -> auth.organization
    -> auth.role
      -> permissions[]

auth.organization
  -> public.smart_account
    -> public.session_key

auth.organization
  -> auth.invitation
```

Access to organization-owned rows follows this rule:

```text
current user
  must have an auth.member row in the row's organization
  whose auth.role.permissions contains the required permission
```

The SQL helper for that rule is:

```sql
auth_user_has_permissions_in_org(org_id text, required_permissions text[])
```

## Permission Catalog

| Resource       | Permissions                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Organization   | `org:read`, `org:update`, `org:delete`                                                                     |
| Billing        | `billing:read`, `billing:update`, `billing:cancel`                                                         |
| Members        | `member:read`, `member:invite`, `member:update`, `member:remove`                                           |
| Roles          | `role:read`, `role:create`, `role:update`, `role:delete`, `role:assign`                                    |
| Invitations    | `invitation:read`, `invitation:create`, `invitation:update`, `invitation:delete`, `invitation:resend`      |
| Smart accounts | `smart_account:read`, `smart_account:create`, `smart_account:update`, `smart_account:delete`               |
| Session keys   | `session_key:read`, `session_key:create`, `session_key:update`, `session_key:delete`, `session_key:revoke` |

Built-in roles seeded when a new organization is created:

| Role     | Description                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| `owner`  | All permissions. Cannot be deleted. At least one owner-equivalent member must remain in each organization. |
| `admin`  | Operational administration, usually all permissions except destructive billing/org ownership actions.      |
| `member` | Product usage permissions, usually smart account/session key access.                                       |
| `viewer` | Read-only permissions.                                                                                     |

## Permission Dependencies

The API should validate dependencies when creating or updating roles.

| Permission             | Requires                                          |
| ---------------------- | ------------------------------------------------- |
| `role:create`          | `role:read`                                       |
| `role:update`          | `role:read`                                       |
| `role:delete`          | `role:read`                                       |
| `role:assign`          | `role:read`                                       |
| `member:invite`        | `member:read`, `invitation:create`, `role:assign` |
| `member:update`        | `member:read`, `role:assign`                      |
| `member:remove`        | `member:read`                                     |
| `invitation:create`    | `invitation:read`, `role:assign`                  |
| `invitation:update`    | `invitation:read`                                 |
| `invitation:delete`    | `invitation:read`                                 |
| `invitation:resend`    | `invitation:read`                                 |
| `smart_account:create` | `smart_account:read`                              |
| `smart_account:update` | `smart_account:read`                              |
| `smart_account:delete` | `smart_account:read`                              |
| `session_key:create`   | `session_key:read`, `smart_account:read`          |
| `session_key:update`   | `session_key:read`                                |
| `session_key:delete`   | `session_key:read`                                |
| `session_key:revoke`   | `session_key:read`                                |

## RLS Responsibility Split

RLS should stay small and hard to bypass.

RLS should enforce:

- Current user can access only their own user/account/session rows.
- Organization rows are visible/mutable only to members with the required
  permission.
- Inserted organization-owned rows must use an organization the current user is
  allowed to access.
- Cross-table references remain inside the same organization, such as a session
  key referencing a smart account in the same organization.
- Admin role can access all rows.

The API should enforce:

- Product workflows and state transitions.
- Billing and plan limits.
- Slug availability and upload handling.
- Role permission dependency validation.
- "Cannot grant more permissions than you have."
- "Cannot assign a role you are not allowed to assign."
- "Cannot remove or demote the last owner-equivalent member."
- System role immutability.
- Better error messages, audit logs, rate limits, and idempotency.

Critical invariants should be enforced in both API and database-level checks or
triggers when possible:

- No cross-organization role/member/session-key relationships.
- No last owner removal/demotion.
- No editing or deleting system roles.
- No privilege escalation through custom roles.

## Activity and Notification Model

Domain tables intentionally do not carry detailed audit columns such as
`role_changed_by_id` or `updated_by_id` on every resource. Important mutations
should be written to future append-only event tables.

Recommended future tables:

| Table                | Purpose                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `organization_event` | Canonical append-only organization activity/audit log.                |
| `notification`       | Per-recipient inbox/read/archive state generated from events.         |
| `chain_event`        | Raw indexed smart contract logs keyed by chain/transaction/log index. |

`organization_event` should use normal columns for queryable dimensions:

```text
id
organization_id
actor_user_id
type
entity_type
entity_id
target_user_id
metadata
created_at
```

Use `metadata` only for event-specific payload such as previous/next role ids,
revoke reason, or chain transaction details. One event can fan out to many
notifications; notifications should not be the source of truth for audit.

## Common Column Conventions

All tables use:

| Column       | Type                       | Description                         |
| ------------ | -------------------------- | ----------------------------------- |
| `id`         | `text`                     | Primary key, generated with UUIDv7. |
| `created_at` | `timestamp with time zone` | Creation timestamp.                 |
| `updated_at` | `timestamp with time zone` | Last update timestamp.              |
| `deleted_at` | `timestamp with time zone` | Nullable soft-delete marker.        |

Application id types are branded strings in `packages/schema/src/common/brand.ts`.

## JSON Shapes

### `MetadataIcon`

Used inside organization and role metadata.

```json
{
  "type": "icon | emoji | image",
  "value": "string"
}
```

### `OrganizationMetadata`

```json
{
  "name": "string, 3-128 chars, /^[a-zA-Z0-9-_]+$/",
  "logo": "MetadataIcon"
}
```

### `OrganizationRoleMetadata`

```json
{
  "logo": "MetadataIcon"
}
```

### `SmartAccountMetadata`

```json
{
  "icon": {
    "type": "icon | emoji",
    "value": "string"
  },
  "name": "string, 4-255 chars"
}
```

### `SerializedAccount`

```json
{
  "chain": "SupportedChain",
  "serializedAccount": "string"
}
```

### `SessionKeyMetadata`

```json
{
  "icon": {
    "type": "icon | emoji",
    "value": "string"
  },
  "name": "string, 4-255 chars",
  "description": "optional string"
}
```

### `SessionKeyData`

Currently only ECDSA session keys are modeled.

```json
{
  "address": "0x-prefixed 20-byte Ethereum address",
  "encPrivateKey": "string"
}
```

## Auth Schema

### `auth.user`

Represents a Namera user.

| Column           | Type          | Null | Description                                      |
| ---------------- | ------------- | ---- | ------------------------------------------------ |
| `id`             | `text`        | no   | User id.                                         |
| `name`           | `text`        | no   | Display name.                                    |
| `email`          | `text`        | no   | Unique email address.                            |
| `email_verified` | `boolean`     | no   | Whether email is verified. Defaults to `false`.  |
| `image`          | `text`        | yes  | Avatar URL or image reference.                   |
| `metadata`       | `json`        | no   | `UserMetadata`; currently an empty object shape. |
| `last_login_at`  | `timestamptz` | no   | Last successful login timestamp.                 |
| `deleted_at`     | `timestamptz` | yes  | Soft-delete marker for user deletion workflows.  |
| `created_at`     | `timestamptz` | no   | Created timestamp.                               |
| `updated_at`     | `timestamptz` | no   | Updated timestamp.                               |

Indexes and constraints:

| Name                 | Type        | Columns |
| -------------------- | ----------- | ------- |
| implicit primary key | primary key | `id`    |
| implicit unique      | unique      | `email` |

RLS:

| Policy              | Operation | Rule                                                         |
| ------------------- | --------- | ------------------------------------------------------------ |
| `user_select`       | `select`  | `id = auth_current_user_id()`                                |
| `user_update`       | `update`  | existing and new row must have `id = auth_current_user_id()` |
| `user_admin_access` | `all`     | `app_admin` can access all rows                              |

API responsibilities:

- Create users through the auth flow.
- Prevent user-controlled mutation of protected fields such as
  `email_verified`, `metadata`, `last_login_at`, and `deleted_at`.
- Validate profile update inputs.
- Update `last_login_at` only after successful authentication.
- Handle soft delete as an admin or account-deletion workflow.

### `auth.account`

Represents a login/provider account connected to a user.

| Column                     | Type          | Null | Description                               |
| -------------------------- | ------------- | ---- | ----------------------------------------- |
| `id`                       | `text`        | no   | Account row id.                           |
| `account_id`               | `text`        | no   | Provider account id.                      |
| `provider_id`              | `text`        | no   | Provider name/id.                         |
| `user_id`                  | `text`        | no   | FK to `auth.user.id`, cascade delete.     |
| `access_token`             | `text`        | yes  | Provider access token.                    |
| `access_token_expires_at`  | `timestamptz` | yes  | Access token expiry.                      |
| `refresh_token`            | `text`        | yes  | Provider refresh token.                   |
| `refresh_token_expires_at` | `timestamptz` | yes  | Refresh token expiry.                     |
| `id_token`                 | `text`        | yes  | Provider id token.                        |
| `password`                 | `text`        | yes  | Password hash when password auth is used. |
| `scope`                    | `text`        | yes  | Provider scopes.                          |
| `last_used_at`             | `timestamptz` | yes  | Last time this account/provider was used. |
| `created_at`               | `timestamptz` | no   | Created timestamp.                        |
| `updated_at`               | `timestamptz` | no   | Updated timestamp.                        |
| `deleted_at`               | `timestamptz` | yes  | Soft-delete marker for unlink workflows.  |

Indexes and constraints:

| Name                               | Type           | Columns                                                |
| ---------------------------------- | -------------- | ------------------------------------------------------ |
| implicit primary key               | primary key    | `id`                                                   |
| `account_userId_idx`               | index          | `user_id`                                              |
| `account_providerId_accountId_idx` | partial unique | `provider_id`, `account_id` where `deleted_at IS NULL` |

RLS:

| Policy                 | Operation | Rule                                                              |
| ---------------------- | --------- | ----------------------------------------------------------------- |
| `account_select`       | `select`  | `user_id = auth_current_user_id()`                                |
| `account_insert`       | `insert`  | new row must have `user_id = auth_current_user_id()`              |
| `account_update`       | `update`  | existing and new row must have `user_id = auth_current_user_id()` |
| `account_admin_access` | `all`     | `app_admin` can access all rows                                   |

API responsibilities:

- Own provider linking/unlinking flows.
- Prevent unlinking the last usable login method.
- Keep token refresh, encryption, and provider validation out of client control.
- Treat unlink as a soft delete by setting `deleted_at`.
- Update `last_used_at` when this provider/account is used for authentication.
- Normal account lookups should ignore rows where `deleted_at IS NOT NULL`.

### `auth.session`

Represents an authenticated user session.

| Column                   | Type          | Null | Description                                           |
| ------------------------ | ------------- | ---- | ----------------------------------------------------- |
| `id`                     | `text`        | no   | Session id.                                           |
| `token`                  | `text`        | no   | Unique session token.                                 |
| `user_id`                | `text`        | no   | FK to `auth.user.id`, cascade delete.                 |
| `active_organization_id` | `text`        | yes  | FK to `auth.organization.id`, set null on org delete. |
| `ip_address`             | `text`        | yes  | Session IP address.                                   |
| `user_agent`             | `text`        | yes  | Session user agent.                                   |
| `expires_at`             | `timestamptz` | no   | Session expiry.                                       |
| `revoked_at`             | `timestamptz` | yes  | Set when the session is revoked/logged out.           |
| `created_at`             | `timestamptz` | no   | Created timestamp.                                    |
| `updated_at`             | `timestamptz` | no   | Updated timestamp.                                    |
| `deleted_at`             | `timestamptz` | yes  | Soft-delete marker from shared timestamps.            |

Indexes and constraints:

| Name                               | Type        | Columns                  |
| ---------------------------------- | ----------- | ------------------------ |
| implicit primary key               | primary key | `id`                     |
| `session_token_idx`                | unique      | `token`                  |
| `session_user_active_idx`          | index       | `user_id`, `expires_at`  |
| `session_activeOrganizationId_idx` | index       | `active_organization_id` |
| `session_expiresAt_idx`            | index       | `expires_at`             |

RLS:

| Policy           | Operation | Rule                                                                                                                                                         |
| ---------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `session_select` | `select`  | `user_id = auth_current_user_id()`                                                                                                                           |
| `session_update` | `update`  | existing row must belong to current user; new row must belong to current user and `active_organization_id` must be null or an org where the user is a member |
| `session_access` | `all`     | `app_admin` can access all rows                                                                                                                              |

API responsibilities:

- Create sessions after authentication only.
- Expose a narrow active-organization switch endpoint.
- Do not allow client-controlled updates to token, expiry, IP, user agent, or user id.
- Revoke/logout sessions by setting `revoked_at`, not by user hard delete.
- Normal session validation should require `revoked_at IS NULL`,
  `deleted_at IS NULL`, and `expires_at > now()`.

### `auth.organization`

Represents an organization/tenant.

| Column          | Type          | Null | Description                                               |
| --------------- | ------------- | ---- | --------------------------------------------------------- |
| `id`            | `text`        | no   | Organization id.                                          |
| `name`          | `text`        | no   | Queryable organization display name.                      |
| `metadata`      | `json`        | yes  | `OrganizationMetadata`; currently logo metadata.          |
| `plan`          | `text`        | no   | Organization plan. Currently `free`.                      |
| `slug`          | `text`        | no   | Unique public slug, 3-63 chars, alphanumeric plus hyphen. |
| `created_by_id` | `text`        | yes  | FK to `auth.user.id`; creator of the organization.        |
| `created_at`    | `timestamptz` | no   | Created timestamp.                                        |
| `updated_at`    | `timestamptz` | no   | Updated timestamp.                                        |
| `deleted_at`    | `timestamptz` | yes  | Soft-delete marker from shared timestamps.                |

Indexes and constraints:

| Name                     | Type        | Columns       |
| ------------------------ | ----------- | ------------- |
| implicit primary key     | primary key | `id`          |
| `organization_slug_uidx` | unique      | `lower(slug)` |

RLS:

| Policy                      | Operation | Required permission             |
| --------------------------- | --------- | ------------------------------- |
| `organization_select`       | `select`  | `org:read`                      |
| `organization_update`       | `update`  | `org:update`                    |
| `organization_admin_access` | `all`     | `app_admin` can access all rows |

API responsibilities:

- Create organizations with the trusted admin/service role.
- Enforce user/org creation limits.
- Seed built-in roles and first owner membership transactionally.
- Validate slug availability.
- Handle logo upload.
- Enforce billing and plan rules.
- Require confirmation and audit logging for deletion.
- Treat delete as a soft-delete workflow by setting `deleted_at`.
- Normal organization queries should ignore rows where `deleted_at IS NOT NULL`.

### `auth.role`

Represents an organization role. Roles are permission containers.

| Column            | Type          | Null | Description                                   |
| ----------------- | ------------- | ---- | --------------------------------------------- |
| `id`              | `text`        | no   | Role id.                                      |
| `name`            | `text`        | no   | Role name.                                    |
| `organization_id` | `text`        | no   | FK to `auth.organization.id`, cascade delete. |
| `metadata`        | `json`        | no   | `OrganizationRoleMetadata`.                   |
| `permissions`     | `text[]`      | no   | Permission keys from the catalog.             |
| `created_at`      | `timestamptz` | no   | Created timestamp.                            |
| `updated_at`      | `timestamptz` | no   | Updated timestamp.                            |
| `deleted_at`      | `timestamptz` | yes  | Soft-delete marker from shared timestamps.    |

Indexes and constraints:

| Name                           | Type        | Columns                   |
| ------------------------------ | ----------- | ------------------------- |
| implicit primary key           | primary key | `id`                      |
| `role_name_organizationId_idx` | unique      | `name`, `organization_id` |
| `role_organization_id_id_uidx` | unique      | `organization_id`, `id`   |
| `role_organizationId_idx`      | index       | `organization_id`         |

RLS:

| Policy              | Operation | Required permission             |
| ------------------- | --------- | ------------------------------- |
| `role_select`       | `select`  | `role:read`                     |
| `role_insert`       | `insert`  | `role:create`                   |
| `role_update`       | `update`  | `role:update`                   |
| `role_admin_access` | `all`     | `app_admin` can access all rows |

API responsibilities:

- Validate permissions against the known catalog.
- Validate permission dependencies.
- Prevent creating/updating roles with permissions the actor does not have.
- Prevent editing or soft-deleting built-in system roles.
- Require `role:assign` when assigning roles to members or invitations.
- Treat role deletion as a soft-delete workflow by setting `deleted_at`.
- Prevent soft-deleting a role that is still assigned to active members or
  pending invitations.

### `auth.member`

Represents a user's membership in an organization.

| Column            | Type          | Null | Description                                                                              |
| ----------------- | ------------- | ---- | ---------------------------------------------------------------------------------------- |
| `id`              | `text`        | no   | Member row id.                                                                           |
| `organization_id` | `text`        | no   | FK to `auth.organization.id`, cascade delete.                                            |
| `role_id`         | `text`        | no   | Role assigned to this member. Intended invariant: role belongs to the same organization. |
| `user_id`         | `text`        | no   | FK to `auth.user.id`, cascade delete.                                                    |
| `joined_at`       | `timestamptz` | no   | Membership activation timestamp.                                                         |
| `removed_at`      | `timestamptz` | yes  | Set when the member leaves or is removed.                                                |
| `created_at`      | `timestamptz` | no   | Created timestamp.                                                                       |
| `updated_at`      | `timestamptz` | no   | Updated timestamp.                                                                       |
| `deleted_at`      | `timestamptz` | yes  | Soft-delete marker from shared timestamps.                                               |

Indexes and constraints:

| Name                            | Type        | Columns                                                                  |
| ------------------------------- | ----------- | ------------------------------------------------------------------------ |
| implicit primary key            | primary key | `id`                                                                     |
| `member_organizationId_idx`     | index       | `organization_id`                                                        |
| `member_userId_idx`             | index       | `user_id`                                                                |
| `member_user_organization_uidx` | unique      | `user_id`, `organization_id`                                             |
| `member_organization_role_fk`   | foreign key | `(organization_id, role_id)` references `auth.role(organization_id, id)` |

RLS:

| Policy                | Operation | Rule                                           |
| --------------------- | --------- | ---------------------------------------------- |
| `member_select`       | `select`  | Requires `member:read` in `organization_id`.   |
| `member_insert`       | `insert`  | Requires `member:invite` in `organization_id`. |
| `member_update`       | `update`  | Requires `member:update` in `organization_id`. |
| `member_admin_access` | `all`     | `app_admin` can access all rows.               |

API responsibilities:

- Prefer invitation acceptance for normal member creation.
- Validate the target user and target role.
- Require `role:assign` when setting or changing `role_id`.
- Prevent assigning a role with permissions greater than the actor's
  permissions.
- Prevent removing or demoting the last owner-equivalent member.
- Treat removal as a lifecycle update by setting `removed_at` and/or
  `deleted_at`; keep hard delete for admin/maintenance only.
- Write role changes, removals, rejoins, and suspensions to the future
  organization event/inbox system instead of storing audit columns here.
- Decide and enforce self-leave behavior.

### `auth.invitation`

Represents an invitation to join an organization.

| Column            | Type          | Null | Description                                                                                  |
| ----------------- | ------------- | ---- | -------------------------------------------------------------------------------------------- |
| `id`              | `text`        | no   | Invitation id.                                                                               |
| `email`           | `text`        | no   | Invitee email.                                                                               |
| `role_id`         | `text`        | no   | Role assigned by this invitation. Intended invariant: role belongs to the same organization. |
| `organization_id` | `text`        | no   | FK to `auth.organization.id`, cascade delete.                                                |
| `inviter_id`      | `text`        | no   | FK to `auth.user.id`, no action on delete.                                                   |
| `status`          | `text`        | no   | `pending`, `accepted`, or `rejected`.                                                        |
| `expires_at`      | `timestamptz` | no   | Invitation expiry.                                                                           |
| `created_at`      | `timestamptz` | no   | Created timestamp.                                                                           |
| `updated_at`      | `timestamptz` | no   | Updated timestamp.                                                                           |
| `deleted_at`      | `timestamptz` | yes  | Soft-delete marker from shared timestamps.                                                   |

Indexes and constraints:

| Name                              | Type        | Columns                                                                  |
| --------------------------------- | ----------- | ------------------------------------------------------------------------ |
| implicit primary key              | primary key | `id`                                                                     |
| `invitation_organizationId_idx`   | index       | `organization_id`                                                        |
| `invitation_email_idx`            | index       | `email`                                                                  |
| `invitation_organization_role_fk` | foreign key | `(organization_id, role_id)` references `auth.role(organization_id, id)` |

Recommended additional constraints:

- Unique pending invitation per organization/email.

RLS:

| Policy                    | Operation | Required permission             |
| ------------------------- | --------- | ------------------------------- |
| `invitation_select`       | `select`  | `invitation:read`               |
| `invitation_insert`       | `insert`  | `invitation:create`             |
| `invitation_update`       | `update`  | `invitation:update`             |
| `invitation_admin_access` | `all`     | `app_admin` can access all rows |

API responsibilities:

- Create invitations through a workflow endpoint.
- Require `role:assign` for the invited role.
- Prevent inviting to a role with permissions greater than the actor's
  permissions.
- Validate duplicate pending invites.
- Enforce expiry, accept, reject, cancel, and resend state transitions.
- Accept invitation by creating `auth.member` transactionally and setting the
  user's active organization.
- Treat cancellation/deletion as a state/lifecycle update, not app-user hard
  delete.

### `auth.verification`

Stores temporary verification values such as magic-link codes, provider link
state, and email verification tokens.

| Column       | Type          | Null | Description                                |
| ------------ | ------------- | ---- | ------------------------------------------ |
| `id`         | `text`        | no   | Verification row id.                       |
| `identifier` | `text`        | no   | Verification identifier.                   |
| `value`      | `text`        | no   | Secret value/code/token.                   |
| `expires_at` | `timestamptz` | no   | Expiry timestamp.                          |
| `created_at` | `timestamptz` | no   | Created timestamp.                         |
| `updated_at` | `timestamptz` | no   | Updated timestamp.                         |
| `deleted_at` | `timestamptz` | yes  | Soft-delete marker from shared timestamps. |

Indexes and constraints:

| Name                          | Type        | Columns      |
| ----------------------------- | ----------- | ------------ |
| implicit primary key          | primary key | `id`         |
| `verification_identifier_idx` | unique      | `identifier` |

RLS:

| Policy                      | Operation | Rule                            |
| --------------------------- | --------- | ------------------------------- |
| `verification_admin_access` | `all`     | `app_admin` can access all rows |

API responsibilities:

- Own all verification lifecycle operations.
- Enforce expiry, replay protection, and rate limits.
- Never expose raw verification values to clients.
- Verification rows are service/admin-owned; cleanup jobs may hard-delete
  expired/consumed rows according to retention policy.

## Core Schema

### `public.smart_account`

Represents an organization smart account.

| Column               | Type          | Null | Description                                   |
| -------------------- | ------------- | ---- | --------------------------------------------- |
| `id`                 | `text`        | no   | Smart account id.                             |
| `organization_id`    | `text`        | no   | FK to `auth.organization.id`, cascade delete. |
| `creator_id`         | `text`        | no   | FK to `auth.user.id`, no action on delete.    |
| `metadata`           | `json`        | no   | `SmartAccountMetadata`.                       |
| `entrypoint_version` | `text`        | no   | `0.7`, `0.8`, or `0.9`.                       |
| `kernel_version`     | `text`        | no   | `0.3.1`, `0.3.2`, or `0.3.3`.                 |
| `index`              | `integer`     | no   | Non-negative account index.                   |
| `address`            | `text`        | no   | Ethereum address.                             |
| `owner_type`         | `text`        | no   | `ecdsa` or `passkey`.                         |
| `owner`              | `text`        | no   | ECDSA address or passkey credential id.       |
| `created_at`         | `timestamptz` | no   | Created timestamp.                            |
| `updated_at`         | `timestamptz` | no   | Updated timestamp.                            |
| `deleted_at`         | `timestamptz` | yes  | Soft-delete marker from shared timestamps.    |

Indexes and constraints:

| Name                               | Type        | Columns               |
| ---------------------------------- | ----------- | --------------------- |
| implicit primary key               | primary key | `id`                  |
| `smart_account_organizationId_idx` | index       | `organization_id`     |
| `smart_account_creatorId_idx`      | index       | `creator_id`          |
| `smart_account_owner_index_idx`    | index       | `owner`, `index DESC` |
| `smart_account_address_uidx`       | unique      | `address`             |

RLS:

| Policy                       | Operation | Required permission / rule                                       |
| ---------------------------- | --------- | ---------------------------------------------------------------- |
| `smart_account_select`       | `select`  | `smart_account:read`                                             |
| `smart_account_insert`       | `insert`  | `smart_account:create` and `creator_id = auth_current_user_id()` |
| `smart_account_update`       | `update`  | `smart_account:update`                                           |
| `smart_account_admin_access` | `all`     | `app_admin` can access all rows                                  |

API responsibilities:

- Validate owner format according to `owner_type`.
- Validate chain/account derivation rules.
- Enforce plan limits.
- Decide which fields are immutable after creation, such as `address`,
  `entrypoint_version`, `kernel_version`, and `index`.
- Treat deletion/archive as a soft-delete workflow by setting `deleted_at`.
- Record creation, updates, archive/delete, and ownership/security-sensitive
  changes in the future organization event/inbox system.

### `public.session_key`

Represents a session key associated with an organization smart account.

| Column                | Type          | Null | Description                                      |
| --------------------- | ------------- | ---- | ------------------------------------------------ |
| `id`                  | `text`        | no   | Session key id.                                  |
| `metadata`            | `json`        | no   | `SessionKeyMetadata`.                            |
| `creator_id`          | `text`        | no   | FK to `auth.user.id`, no action on delete.       |
| `organization_id`     | `text`        | no   | FK to `auth.organization.id`, cascade delete.    |
| `smart_account_id`    | `text`        | no   | FK to `public.smart_account.id`, cascade delete. |
| `serialized_accounts` | `json`        | no   | Array of `SerializedAccount`.                    |
| `type`                | `text`        | no   | Session key type. Currently `ecdsa` is modeled.  |
| `data`                | `json`        | no   | `SessionKeyData`.                                |
| `created_at`          | `timestamptz` | no   | Created timestamp.                               |
| `updated_at`          | `timestamptz` | no   | Updated timestamp.                               |
| `deleted_at`          | `timestamptz` | yes  | Soft-delete marker from shared timestamps.       |

Indexes and constraints:

| Name                             | Type        | Columns            |
| -------------------------------- | ----------- | ------------------ |
| implicit primary key             | primary key | `id`               |
| `session_key_organizationId_idx` | index       | `organization_id`  |
| `session_key_smartAccountId_idx` | index       | `smart_account_id` |
| `session_key_creator_idx`        | index       | `creator_id`       |
| `session_key_type_idx`           | index       | `type`             |

RLS:

| Policy                     | Operation | Required permission / rule                                                                                                       |
| -------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `session_key_select`       | `select`  | `session_key:read`                                                                                                               |
| `session_key_insert`       | `insert`  | `session_key:create`, `creator_id = auth_current_user_id()`, and referenced smart account belongs to `organization_id`           |
| `session_key_update`       | `update`  | `session_key:update`, existing session key belongs to `organization_id`, and new `smart_account_id` belongs to `organization_id` |
| `session_key_admin_access` | `all`     | `app_admin` can access all rows                                                                                                  |

API responsibilities:

- Validate key type and key data.
- Validate encrypted private key handling.
- Prevent creating a session key with broader capability than the actor should
  have.
- Enforce expiry, revocation, usage limits, and audit logging.
- Prefer a revoke/update workflow over app-user hard delete.
- Record create, revoke, update, and use events in the future organization
  event/inbox system when they matter to audit or notifications.

## SQL Helper Functions

### `auth_current_user_id()`

Returns the current application user id from `app.user_id`.

Required behavior:

- Return `NULL` when the setting is missing or empty.
- Be stable for a statement.

### `auth_user_has_org_access(org_id text)`

Returns true when the current user has an active member row in the organization.

Use for coarse membership checks, such as validating
`session.active_organization_id`.

### `auth_user_has_permissions_in_org(org_id text, required_permissions text[])`

Returns true when the current user has a member row in the organization and the
member's role contains all required permissions.

Required behavior:

- Join `auth.member` to `auth.role`.
- Ensure role and member belong to the same organization.
- Ignore removed or soft-deleted members.
- Ignore soft-deleted roles.
- Use containment semantics: `role.permissions @> required_permissions`.

### `auth_smart_account_in_org(smart_account_id text, org_id text)`

Returns true when the smart account belongs to the given organization.

Used by `session_key` insert/update policies to prevent cross-organization
references.

### `auth_session_key_in_org(session_key_id text, org_id text)`

Returns true when the session key belongs to the given organization.

Used by `session_key` update policies and API lifecycle checks.

## Database/API Enforcement Matrix

| Area           | RLS                                              | API                                             | Both                                                         |
| -------------- | ------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------ |
| User profile   | Own-row access                                   | Field validation and protected field filtering  | User id ownership                                            |
| Auth accounts  | Own-row access                                   | Provider workflows and last-login-method checks | User id ownership                                            |
| Sessions       | Own-row access and active org membership         | Login/logout/switch-org workflows               | Active org must be a real membership                         |
| Organizations  | Permission gate                                  | Creation limits, slug/logo/billing workflows    | Deletion safety                                              |
| Roles          | Permission gate                                  | Dependency validation, custom role rules        | Privilege escalation prevention                              |
| Members        | Permission gate                                  | Invitation/assignment/removal workflows         | Last owner protection and same-org role assignment           |
| Invitations    | Permission gate                                  | State machine, expiry, resend, accept           | Same-org role assignment and privilege escalation prevention |
| Smart accounts | Permission gate                                  | Web3 validation, plan limits, immutable fields  | Org boundary                                                 |
| Session keys   | Permission gate and same-org smart account check | Key scope, expiry, revoke, audit                | Org boundary and capability escalation prevention            |
| Verification   | Admin-only                                       | Rate limits, expiry, replay protection          | Secret isolation                                             |

## Known Alignment Checks

Keep these checks green when changing the schema:

- `packages/database` table columns match `packages/schema` Effect schemas.
- Permission strings in policies exist in `packages/schema/src/auth/permissions.ts`.
- `auth.member.role_id` references `auth.role.id`.
- `auth.member.role_id` belongs to the same organization as the member.
- `auth.invitation.role_id` references an organization role id.
- `auth.invitation.role_id` belongs to the same organization as the invitation.
- Policy names match their table and operation.
- Fresh migrations do not contain stale role-name policies such as owner/admin
  string checks.
- Organization creation is service/admin-controlled and seeds organization,
  built-in roles, first owner member, and active session organization in one
  transaction.

## Production Hardening Checklist

Before building the API on top of this schema, complete these items.

### P0: correctness and security blockers

- Ensure generated migrations preserve valid same-organization role constraints
  for `auth.member` and `auth.invitation`: `(organization_id, role_id) ->
auth.role(organization_id, id)`.
- Add a database-level invariant for "at least one owner-equivalent member
  remains" if organization ownership must be non-orphanable.
- Add privilege-escalation protection for role creation/update/assignment:
  actors must not create, grant, or assign permissions they do not already have.
  Enforce in API and consider a DB helper/trigger for defense in depth.
- Keep Effect schemas aligned with shared lifecycle columns such as
  `deletedAt`.

### P1: schema and policy quality

- Add system-role fields to `auth.role`, such as `key`, `system`, and possibly
  `rank`, if built-in roles need immutability and ordered privilege checks.
- Add append-only organization event and notification/inbox tables for audit and
  user-facing activity.
- Include required DB fields in insert schemas unless the API supplies defaults
  elsewhere.
- Add unique pending invitation constraint, usually a partial unique index on
  `(organization_id, lower(email)) WHERE status = 'pending'`.
- Consider lower-cased unique indexes for case-insensitive fields:
  organization slug, email, role name, and invitation email.

### P2: operational hardening

- Add explicit check constraints for enum-like database text fields where useful:
  organization plan, invitation status, owner type, entrypoint/kernel versions,
  and session key type.
- Add `expires_at`/revocation fields to session keys if hard delete is not the
  desired operational model.
- Add indexes based on API read paths: pending invitations by org/email,
  session keys by org/smart account/type, and smart accounts by org/address or
  org/owner when needed.
- Keep RLS focused on tenant isolation and minimum permission gates; keep plan
  limits, workflow state machines, detailed role validation, and user-facing
  errors in the API.
