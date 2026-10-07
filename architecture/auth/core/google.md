# Google sign-in and connected accounts

Google uses authorization-code OpenID Connect with PKCE S256, a nonce and a
browser-bound HttpOnly `google-auth` cookie. The server alone exchanges the code
and verifies the signed ID token against Google's JWKS (`RS256`, issuer,
audience, authorized party, expiry, subject, verified email and nonce). `jose`
owns signature verification and JWKS caching; Namera owns admission and sessions.

## Configuration

Set both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the server, or leave
both empty to disable Google. A partial configuration fails startup. No Google
secret or provider endpoint is configured in the dashboard.

Use a Google OAuth **Web application** client. Register the exact redirect URI
`${AUTH_API_PUBLIC_ORIGIN}/auth/google/callback`, for example
`https://api.namera.ai/auth/google/callback` or
`http://localhost:8080/auth/google/callback`. Configure the consent screen and
test users while the Google application is in testing mode. Only `openid email
profile` is requested; no offline access or Google API access is retained.

## Identity and admission

- `auth.account` binds Google's stable `sub` to one Namera user with provider
  `google`. Email is presentation data, never the provider identifier. Provider
  access/refresh/ID tokens and passwords remain null.
- A new Google subject whose email already belongs to a Namera user **does not
  automatically link**. Sign in through email and connect Google in Security.
- New Gmail and verified Workspace identities can enter the normal beta-invite
  gate. For other Google email domains, an existing magic-link email challenge
  must prove mailbox ownership before a binding is created. Google documents
  that `email_verified` alone is insufficient for third-party email ownership.
- Verified new users without an invite receive only the existing restricted
  beta-signup cookie. No user, workspace, session or sign-in audit is created
  until invite redemption. Provider identity travels in the trusted challenge,
  never in a browser payload. A matching-email race cannot turn beta admission
  into an automatic account link.
- Successful sign-in uses the shared email/Google completion workflow: user and
  workspace initialization, beta admission, session, audit and notification.

## Routes and dashboard

`GET /auth/google/configuration` reports availability. `POST /auth/google/start`
accepts an approved `returnTo` and optional invite. `GET /auth/google/callback`
redirects to the configured dashboard; it never returns provider tokens.

`GET /auth/connected-accounts/`, `POST /auth/connected-accounts/google` and
`DELETE /auth/connected-accounts/:accountId` require a human session. Mutations
check the exact dashboard Origin and existing auth rate limits. Linking and
unlinking require a live session created within ten minutes. The callback also
rechecks its initiating user, session and cookie after the provider exchange.
Security settings offer explicit sign-out/reauthentication when needed.

One Google account per user and one user per Google subject are database
constraints. User row locks serialize link/unlink/sign-in; conflict-safe account
insertion cannot steal another user's binding. A concurrent new-user creation
conflict rolls back rather than silently joining another identity.

Unlink deletes only the binding. Verified Namera email sign-in remains available;
existing sessions are not silently revoked. The confirmation explains this.

## Proof lifecycle and observability

`auth.verification` purpose `google-auth` expires after ten minutes. It stores
purpose-separated state/nonce/browser hashes and an encrypted PKCE verifier.
Callback consumption is conditional and occurs before code exchange: a replay
cannot exchange twice. Failure needs a fresh flow. Parallel browser starts
invalidate older attempts through the single browser cookie.

Binding mutation, `user.account_linked`/`user.account_unlinked` audit, inbox
notification and durable `connected-account-changed` email enqueue are atomic.
Idempotent linking emits no duplicate transition. Successful sign-in keeps
`user.signed_in` with method `google` and the existing new-sign-in notification.

`namera.auth.google.results` and `.duration` use bounded stage/result labels;
`namera.auth.connected_account.transitions` counts committed link/unlink changes.
Application spans describe workflow steps. Callback HTTP tracing is disabled
including query strings, and provider HTTP tracing is disabled, to keep OAuth
codes, state and tokens out of telemetry. Ingress/access logs must likewise omit
callback query strings. Logs and metric attributes contain no emails or subjects.

## Verification and deployment

Apply the generated additive migration through normal startup. Provider tests
verify signatures, issuer, audience, authorized party, expiry and mandatory
claims. Server boundary tests exercise browser/state/nonce/replay validation,
explicit linking, email conflicts, recent authentication, email proof, redirect
cookies and unchanged email authentication. Live Google consent and production
cookie behavior must be checked using the configured OAuth client before launch.
