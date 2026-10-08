# Platform admin authorization

Platform authority belongs to a verified `auth.user`, independently of provider
and organization roles. Email and Google reuse `auth.session`; future providers
need only resolve the same user. No admin session, provider allowlist, shared
bearer token, or organization-actor bypass exists. `ADMIN_TOKEN` is retired.

`AdminAuthorization` accepts only the HttpOnly `auth-token` cookie. It validates
the session and verified user, then loads current active platform membership on
every request. It does not depend on an active customer organization. API keys,
CLI/MCP bearer credentials and ordinary organization owners confer no access.
`CurrentAdmin` contains user ID, session ID and platform member, not a tenant actor.

## Roles

Permissions are a fixed protocol-owned map, not editable database roles.

| Permission                                            | Owner | Operator | Viewer |
| ----------------------------------------------------- | ----- | -------- | ------ |
| `waitlist:read`, `invites:read`                       | Yes   | Yes      | Yes    |
| `waitlist:accept`, `invites:create`, `invites:revoke` | Yes   | Yes      | No     |
| `team:manage`, `ownership:transfer`                   | Yes   | No       | No     |

`waitlist:accept` is reserved for the upcoming transactional acceptance workflow;
this change does not implement that workflow. Legacy user-list and arbitrary
waitlist-status endpoints are temporarily owner-only, pending their removal with
the portal rebuild. They are not operator/viewer capabilities.

## Endpoints

All routes below are excluded from published OpenAPI. `/internal/*` carries
`AdminAuthorization`; invitation acceptance uses `PlatformSessionAuthorization`
because the invitee is not a member yet.

| Method | Path                                | Access                                             |
| ------ | ----------------------------------- | -------------------------------------------------- |
| GET    | `/internal/me`                      | Active member; identity and effective permissions  |
| GET    | `/internal/members`                 | Owner; team including historical removed members   |
| PATCH  | `/internal/members/:id/role`        | Owner; operator or viewer only                     |
| PATCH  | `/internal/members/:id/status`      | Owner; active or suspended                         |
| DELETE | `/internal/members/:id`             | Owner; soft removal                                |
| POST   | `/internal/ownership/transfer`      | Owner; active target member                        |
| GET    | `/internal/member-invitations`      | Owner; newest 100, optional last-ID cursor         |
| POST   | `/internal/member-invitations`      | Owner; email and operator/viewer role; also resend |
| DELETE | `/internal/member-invitations/:id`  | Owner; revoke pending invitation                   |
| POST   | `/auth/platform-invitations/accept` | Verified human session; token in JSON body         |

Team writes and acceptance require a session created within ten minutes. Re-login
through normal email/Google authentication provides that proof. All admin writes
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
requires the matching verified email, fresh session, live single-use token, and a
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
Legacy beta-invite and waitlist mutations also record the named platform member
alongside their existing domain audit rows. No credentials or email payloads enter
audit/logs. Workflow/repository spans use stable names; email delivery and HTTP
metrics reuse existing bounded telemetry. No new dashboard notifications are added.

See [platform table catalog](../database/auth-platform.md) for persistence details.

## Bootstrap and rollout

1. Apply normal database migrations. There is no conversion of shared-token access.
2. Ensure the intended owner already has a verified Namera account.
3. From a trusted server environment with database configuration, run:

   ```sh
   pnpm --filter @namera-ai/server admin:bootstrap owner@example.com
   ```

   The command refuses if an owner exists; it is never run on startup or exposed
   over HTTP. It does not create users or bypass email verification.

4. Set the exact `ADMIN_CORS_ORIGIN`, remove the old admin secret, and use HTTPS.
   Bootstrap does not require Google configuration; existing email login works.

The **old token-based admin SPA is not compatible** with this backend. Its
replacement, invitation-acceptance page, direct admin login/return navigation,
waitlist acceptance + email transaction, and old endpoint removal are explicitly
the next phase. Do not deploy this as a working rebuilt portal. Until that phase,
normal dashboard sign-in supplies the shared API session; auth/team endpoints can
be exercised with that cookie and an approved Origin.

HTTP tests cover role separation, cookie-only auth, origin/freshness guards,
email and Google admission, invitation lifecycle, replay, owner protection and
transfer, audit, and immediate revocation. Run lifecycle races against the
disposable PostgreSQL lane as well as PGlite.
