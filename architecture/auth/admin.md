# Platform admin authorization

Platform authority belongs to a verified `auth.user`, independently of provider
and organization roles. Email and Google reuse `auth.session`; providers
need only resolve the same user. No admin session, provider allowlist, shared
bearer token, or organization-actor bypass exists.

`AdminAuthorization` accepts only the HttpOnly `auth-token` cookie. It validates
the session and verified user, then loads current active platform membership on
every request. It does not depend on an active customer organization. API keys,
CLI/MCP bearer credentials and ordinary organization owners confer no access.
`CurrentAdmin` contains user ID, session ID and platform member, not a tenant actor.

## Roles

Permissions are a fixed protocol-owned map, not editable database roles.

| Permission                          | Owner | Operator | Viewer |
| ----------------------------------- | ----- | -------- | ------ |
| `team:manage`, `ownership:transfer` | Yes   | No       | No     |
| `invites:read`                      | Yes   | Yes      | Yes    |
| `invites:manage`                    | Yes   | Yes      | No     |
| `waitlist:read`                     | Yes   | Yes      | Yes    |
| `waitlist:accept`                   | Yes   | Yes      | No     |
| `overview:read`                     | Yes   | Yes      | Yes    |

Only implemented permissions are defined.

The sidebar's owner-only member action opens Team. Logout uses
`DELETE /auth/platform/logout` with `PlatformSessionAuthorization`, exact-origin
protection and the existing session-revocation workflow/cookie clearing.
It does not require customer organization membership or active platform membership,
so suspended/removed admins can still end their verified browser session.
The route is excluded from OpenAPI and uses existing session audit/telemetry.

## Endpoints

All routes below are excluded from published OpenAPI. `/internal/*` carries
`AdminAuthorization`; invitation acceptance uses `PlatformSessionAuthorization`
because the invitee is not a member yet.

| Method | Path                                | Access                                              |
| ------ | ----------------------------------- | --------------------------------------------------- |
| GET    | `/internal/me`                      | Active member; identity and effective permissions   |
| GET    | `/internal/overview`                | All roles; lifetime counts and 7/30/90-day activity |
| GET    | `/internal/invites`                 | All roles; cursor, status and bound-email filters   |
| POST   | `/internal/invites`                 | Owner/operator; 1–50 codes, optional email for one  |
| DELETE | `/internal/invites/:id`             | Owner/operator; revoke an active code               |
| GET    | `/internal/waitlist`                | All roles; cursor, email and status filters         |
| POST   | `/internal/waitlist/:id/accept`     | Owner/operator; issue and email a bound invite      |
| GET    | `/internal/members`                 | Owner; team including historical removed members    |
| PATCH  | `/internal/members/:id/role`        | Owner; operator or viewer only                      |
| PATCH  | `/internal/members/:id/status`      | Owner; active or suspended                          |
| DELETE | `/internal/members/:id`             | Owner; soft removal                                 |
| POST   | `/internal/ownership/transfer`      | Owner; active target member                         |
| GET    | `/internal/member-invitations`      | Owner; newest 100, optional last-ID cursor          |
| POST   | `/internal/member-invitations`      | Owner; email and operator/viewer role; also resend  |
| DELETE | `/internal/member-invitations/:id`  | Owner; revoke pending invitation                    |
| POST   | `/auth/platform-invitations/accept` | Verified human session; token in JSON body          |

Team writes, beta-invite writes and acceptance require an active verified session,
with no additional recent-sign-in window. New browser sessions last seven days.
All admin writes
require an exact dashboard or configured admin Origin, including non-browser
clients. CORS allows credentials for the configured admin origin, never wildcard.
Existing security middleware supplies no-store. Rate limits are process-local;
move to a shared store before horizontally scaling admission controls.

## Invitation lifecycle

The owner creates a seven-day invitation and an encrypted durable email job in
one transaction. The email URL uses `ADMIN_CORS_ORIGIN` and
`/invitations/accept#token=...`; the fragment avoids server access/referrer logs.
Only the purpose-separated hash is stored in the invitation table; responses and
audit events contain neither token nor hash. Invitation mail bypasses notification
preferences because it is requested access correspondence.

An invited, verified mailbox can complete normal email/Google signup without a
customer beta code while its invitation and issuing owner remain active. This
creates a normal user/session, **not** membership. The subsequent explicit accept
requires the matching verified email, active session, live single-use token, and a
still-active owner issuer. Existing, suspended or removed members cannot use an
invitation to escalate/reactivate; the owner must change them explicitly.

Resending retires previous pending invitations and cancels pending delivery jobs.
Revocation/acceptance also cancel pending delivery. Already-sent or in-flight mail
cannot be recalled, but its token is checked again at acceptance. Ownership
transfer makes the former owner's outstanding invitations unusable; the new owner
can resend them. Expired invitations remain historical and can be replaced.

## Transactions and audit

Team mutations and bootstrap take PostgreSQL transaction advisory lock
`(719204, 1)` before rechecking session/owner authority and changing records.
This serializes low-volume team operations across replicas, including an empty
team. At most one owner is enforced by a partial unique index. The owner must
remain active and generic updates/removal cannot affect them. Transfer demotes
the previous owner to operator and promotes the active target in one transaction.

State and versioned `audit.platform_events` share that transaction. Acceptance
attributes its event to the newly created member; bootstrap alone has no actor.
Beta-invite creation/revocation uses the same team lock to recheck permission
against concurrent membership changes. Each transition appends both its invite
event and actor-attributed platform event atomically. Retired waitlist event
variants remain decodable for historical audit rows. No credentials or email payloads enter
audit/logs. Workflow/repository spans use stable names; email delivery and HTTP
metrics reuse existing bounded telemetry. No new dashboard notifications are added.

See [platform table catalog](../database/auth-platform.md) for persistence details.

## Bootstrap and rollout

1. Apply normal database migrations. There is no conversion of shared-token access.
2. Ensure the intended owner already has a verified Namera account.
3. Set the server environment variable:

   ```sh
   ADMIN_BOOTSTRAP_OWNER_EMAIL=owner@example.com
   ```

   On every server startup, after database migrations and before binding HTTP,
   the server attempts bootstrap using its existing database connection. Unset
   or blank disables it. If any owner already exists, nothing changes, even if
   the configured email differs or ownership has been transferred. A missing or
   unverified account produces `admin.owner_bootstrap_skipped` with reason
   `verified_user_required`; startup continues and the next restart retries.
   No user is created and verification is never bypassed. Invalid email syntax
   or unexpected database failures fail startup rather than silently skipping.
   Successful creation emits `admin.owner_bootstrapped` without the email and
   atomically records `owner.bootstrapped` with membership under the existing
   team lock. Remove the variable after success. There is no bootstrap HTTP
   endpoint or manual command. The standalone `db:migrate` only migrates schema
   and system roles; owner bootstrap belongs to server startup.

4. Set the exact `ADMIN_CORS_ORIGIN`, remove the old admin secret, and use HTTPS.
   Bootstrap does not require Google configuration; existing email login works.

`apps/admin-portal` implements `/auth` with Google
and email/code sign-in, `/auth/verify` with explicit link confirmation, and a
protected page set at `/`, `/waitlist`, `/invites`, and `/team`.
All share one membership-guarded layout and the dashboard-style UIKit sidebar;
Team implements an owner-only member table, invite-by-email, role updates and
confirmed soft removal. Member rows include user display metadata from the existing
user join (no new table). Owner and removed rows have no generic edit/remove actions.
Permission guards hide Team navigation from other roles and prevent member fetching
on denied direct visits. Mutation hooks own query invalidation; rejected access
suppresses stale results and rechecks membership. Invites implements all-role
listing, email/status filters, cursor pagination, single/batch creation, one-time
code/link copying, redeemer display metadata and confirmed revocation. Its atoms,
mutation invalidation and permission guards follow the Team conventions. Waitlist
implements email/status filters, 25-row pagination and confirmed acceptance with
an email-bound invite and durable email job. Overview shows six lifetime totals,
selected-period counts and daily growth/activity charts;
the portal exposes only implemented navigation destinations.
It uses the dashboard's Effect
atom/loader pattern. `/internal/me` distinguishes signed-out, denied, and active
members; transport failures show a retry state rather than pretending logout.
Like the dashboard, the generated client supplies fetch credentials at request
execution through `transformClient`, not only when constructing the fetch layer.
Telemetry shares that memoized layer; construction-only configuration can be
lost when the global runtime builds it first. A client regression test covers
cookie inclusion with the shared global fetch layer present.

Admin sign-in requests send `surface: "admin"`. The API requires the exact
configured admin Origin and stores the surface in the verification challenge.
Emails point to that configured origin. Google uses the existing API callback,
then returns to the admin origin; errors after validated state do likewise.
Unvalidated/expired Google state falls back to the dashboard. There is no
client-controlled cross-origin redirect or separate admin credential.

The invitation acceptance page explicitly posts the token only after user action.
It clears the URL fragment and keeps the token in tab-scoped session storage across
email-code/Google login, then clears it on acceptance or cancellation. A magic link
opened in a different tab requires reopening the invitation afterward. `/auth?reauth=true`
allows existing members to sign in again explicitly when needed.

Team-invitation management and ownership/status controls are API capabilities
without corresponding portal controls.

HTTP tests cover role separation, cookie-only auth, origin and session guards,
email and Google admission, invitation lifecycle, replay, owner protection and
transfer, audit, and immediate revocation. Run lifecycle races against the
disposable PostgreSQL lane as well as PGlite.

## Overview

`GET /internal/overview?period=30d` accepts `7d`, `30d` (default), or `90d`.
The application shares one 90-day snapshot per process for sixty seconds across
all periods and roles. Concurrent misses share the refresh; failures are not
cached. Session and current membership/permission checks run on every request,
including cache hits. The protected loader and hooks share the browser atom
registry; no background polling is added.

PostgreSQL counts users, waitlist entries, wallets, session keys, confirmed
execution records and succeeded signature operations across organizations.
Daily buckets are zero-filled UTC dates, including the partial current day.
Signatures use completion time, not reservation time. Totals count retained rows;
hard-deleted resources cannot be reconstructed. Session-key active/revoked and
pending-waitlist counts reflect stored status at refresh time.

The repository bounds query concurrency to two. Lifetime counts still scan
retained tables once per cache refresh, so large deployments may need indexed
rollups; this is not a constant-cost counter system or a transactionally frozen
snapshot. No Axiom queries, new tables or migrations are required.
Read-only refresh/get/repository spans and existing bounded HTTP telemetry cover
the endpoint; no audit event or new metric series is needed.

Integration tests cover UTC boundaries, empty periods, all-role reads, sixty-second
cache expiry, revoked access on a cache hit, expired sessions, and completed
operations versus signature reservations.
