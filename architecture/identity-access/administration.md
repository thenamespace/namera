# Platform administration

The admin portal is a static browser application. It calls the server's
`/internal` API with a normal verified-user session. Platform membership is
separate from organization membership and grants no wallet ownership.

## Authorization

Active platform members have an `owner`, `operator`, or `viewer` role. Route
middleware authenticates the session and application workflows recheck platform
permissions. Team mutations serialize with privileged writes so a removed or
suspended operator cannot finish a queued write with stale authority.

The database permits one platform owner and requires that owner to remain active.
Invitations grant only operator or viewer roles. Their tokens are hashed in the
invitation table and appear in plaintext only in the encrypted email job and
delivered link. Acceptance checks the verified email and invitation expiry.

`ADMIN_BOOTSTRAP_OWNER_EMAIL` can bootstrap an existing verified user when no
owner exists. Startup skips an absent/unverified user and fails for invalid
configuration or database errors. `ADMIN_CORS_ORIGIN` configures the admin browser
origin and invitation links. Internal writes enforce an approved exact Origin.

## Surfaces

The internal API supports overview, platform team and invitations, beta invite
codes, waitlist admission, feedback triage, and address-catalog administration.
Each route carries `AdminAuthorization` and is excluded from public OpenAPI.
Role permissions remain explicit in the protocol rather than inferred from UI
visibility.

Public waitlist submission normalizes email and creates an idempotent confirmation
job. Accepting an entry issues beta admission and updates waitlist state; it does
not create a user account. Repeated public submissions do not resend confirmation.

## Source

- [Platform workflows](../../packages/application/src/auth/platform/)
- [Internal routes](../../apps/server/src/routes/admin/)
- [Platform schema](../../packages/database/src/schema/auth/platform.ts)
