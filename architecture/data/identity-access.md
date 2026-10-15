# Identity and access tables

All tables below are in the `auth` schema. Credential hashes and references are
internal persistence fields, not public DTOs. Resource IDs generally use text
UUIDv7 values; OAuth wire client identifiers are separate. Timestamps use
timezone-aware PostgreSQL timestamps.

## Human identity

| Table          | Purpose and important constraints                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`         | Normalized unique email, verification flag, profile metadata, last login.                                                                         |
| `account`      | External identity binding; unique `(provider_id, account_id)` and one Google account per user.                                                    |
| `session`      | Unique token hash, user, selected organization, expiry and revocation. Active membership is checked by authorization, not a session foreign key.  |
| `verification` | Purpose-specific proof and ceremony state. One unconsumed/unrevoked row per purpose and identifier; purpose determines required hash/HMAC fields. |
| `beta_invite`  | Unique code HMAC, optional bound email, expiry and mutually exclusive redemption/revocation.                                                      |
| `waitlist`     | Unique normalized email; `pending` or `completed`, with completion timestamp matching status.                                                     |

`account` contains generic provider-token columns, but their presence does not
mean Google tokens are retained or that password login is implemented.

## Tenant authority

| Table                 | Purpose and important constraints                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organization`        | Tenant metadata and creating user. No slug-based identity.                                                                                         |
| `actor`               | Organization-scoped `user`, `api-key`, `mcp`, or `cli` identity. Composite ID/organization key supports tenant-safe references.                    |
| `system_role`         | Unique code-owned role key with permissions and presentation metadata.                                                                             |
| `organization_role`   | Either a system-role reference or complete custom role fields, never both. Custom keys cannot use system-role names.                               |
| `organization_member` | User, actor, and role binding. One active membership per user/organization and one membership per actor. Actor and role must belong to the tenant. |
| `invitation`          | Email, role, inviter, status and expiry. One pending invite per organization/email; role is tenant-bound.                                          |
| `api_key`             | Unique credential hash and actor, visible prefix, expiry/revocation; creator and revoker references are tenant-bound.                              |

Owner-role protection is enforced in workflows and conditional repository writes,
not a database-wide single-owner constraint on organization membership.

## OAuth

| Table                         | Purpose and important constraints                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oauth_client`                | Unique wire client ID, public client metadata, redirects, grants and status. Authentication method is `none`.                                        |
| `oauth_authorization_request` | Expiring consent request bound to client, redirect, resource, scopes and `S256` challenge.                                                           |
| `oauth_authorization`         | Durable CLI/MCP consent and actor; authorizer/revoker share the organization.                                                                        |
| `oauth_authorization_code`    | Unique one-time code hash; composite authorization/client binding.                                                                                   |
| `oauth_device_authorization`  | Unique device hash and user-code HMAC, claiming user, polling state and optional resulting authorization. Polling interval is at least five seconds. |
| `oauth_token`                 | Unique access/refresh hash, audience, scopes and expiry. Refresh tokens have a family; access tokens have no family, parent or consumption time.     |

## Platform administration

`platform_member` is unique per user and permits one active Owner. Other roles are
operator and viewer. `platform_invitation` stores a unique token hash, normalized
email and non-owner role; pending email is unique and acceptance/revocation are
mutually exclusive. These tables are independent of organization roles.

Source: [auth schema](../../packages/database/src/schema/auth/),
[repositories](../../packages/database/src/repositories/auth/).
