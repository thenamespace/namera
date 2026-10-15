# Authentication

Human sign-in uses email verification or Google. The resulting credential is an
opaque seven-day session in the HttpOnly `auth-token` cookie. The database stores
its purpose-separated hash, not the credential.

## Email sign-in

An email request creates one active verification per normalized address and
purpose. Its link token and eight-digit code share a ten-minute lifetime and a
five-attempt limit. Requests have a one-minute resend cooldown. Verification
consumes the proof and creates the session in the same transaction as user setup,
audit records, and notification delivery records.

New users receive a personal organization with an Owner membership and Free
billing account. Beta admission is enabled by default through
`AUTH_INVITE_REQUIRED`. An invite admits a signup; it is not proof of ownership
of the supplied email address.

## Google

Google uses server-side authorization-code exchange, state, nonce, and verified
ID-token claims. Configure both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
The callback is `${AUTH_API_PUBLIC_ORIGIN}/auth/google/callback`.

A provider subject identifies a connected Google account. Matching an existing
email alone does not silently link that account. Account connection and removal
have explicit authenticated workflows. Provider access and refresh tokens are
not needed for subsequent Namera sessions.

## Session authorization

API authorization checks session expiry/revocation and active organization
membership on each request. It resolves permissions from that membership's role.
A stale session or removed active membership clears the browser cookie. Selecting
another organization requires membership in that organization.

Cookies are `SameSite=Lax`, path `/`, and secure outside development. Sensitive
dashboard mutations also require the exact configured dashboard Origin; CORS
alone does not authorize a write. Return paths are constrained to local dashboard
paths rather than arbitrary redirects.

Wallet passkeys are owner-signing credentials, not a separate dashboard login
method. Their registration and assertion verification live in
`@namera-ai/passkeys`; application workflows bind and consume ceremonies.

## Source

- [Sign-in workflows](../../packages/application/src/auth/)
- [Authentication policy](../../packages/application/src/auth/data.ts)
- [Authorization middleware](../../apps/server/src/middlewares/authorization.ts)
- [Credential tables](../data/identity-access.md)
