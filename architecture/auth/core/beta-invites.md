# Private-beta admission

New accounts require an invite by default (`AUTH_INVITE_REQUIRED=true`). Existing
users retain normal email login. This gate runs in magic-link authentication,
not just the dashboard, so CLI and MCP consent cannot create an uninvited user.
Organization invitations do not bypass beta admission.

## Operator API

Set `INVITE_ADMIN_TOKEN` to a randomly generated secret of at least 32 characters
in the server secret manager. Missing or shorter values disable management.
Generate a value with `openssl rand -hex 32`; never put it in frontend variables,
source control, URLs, telemetry, or shared shell history. Rotate it by changing
the secret and restarting the server. It authorizes only these two endpoints,
not wallets or delegated operations. A shared operator credential cannot identify
individual operators; keep distribution narrow and restrict these routes at ingress.

```sh
# Run from a trusted operator machine with the secret supplied securely.
curl --fail-with-body "$API_ORIGIN/internal/invites" \
  -H "Authorization: Bearer $INVITE_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"count":6,"expiresInDays":7}'

# Revoke an unused invite using the ID returned at creation, not its code.
curl --fail-with-body -X DELETE "$API_ORIGIN/internal/invites/$INVITE_ID" \
  -H "Authorization: Bearer $INVITE_ADMIN_TOKEN"
```

Creation accepts 1–50 invites, an optional 1–30-day lifetime (default seven), and
optional `email` binding. It returns `invites: [{id, code, url, expiresAt}]`.
Plaintext codes/links are returned only here; save them privately before sharing.
The link uses the configured dashboard origin: `/auth?invite=K7MP2X`.
Revocation returns `revoked: true` only for a new transition; missing, already
revoked or redeemed IDs return false. It does not remove an admitted user.

## Signup lifecycle

1. The teammate enters the code, or opens a link that prefills it, then enters email.
2. The server checks the code and optional email binding before sending the normal
   email verification challenge. It stores only the invite ID in that challenge.
3. Opening the invite or requesting email never consumes the invite.
4. After proving email ownership, signup locks the active invite and atomically
   creates the user, personal workspace, billing state, session, and redemption.
   Revocation, expiry or a competing redemption prevents signup and rolls back
   all those writes. Two different emails cannot redeem the same invite.
5. Subsequent login and CLI/MCP authorization need no invite.

Requests without a code retain the generic accepted response regardless of whether
the email exists; uninvited new emails receive no message. A supplied invalid,
expired, redeemed, revoked or email-mismatched code returns the same 403
`INVITE_REQUIRED_OR_UNAVAILABLE`. The dashboard explains how to retry.

## Security and persistence

Codes use six cryptographically random characters from
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (30 bits). They are admission credentials, not
email authentication. Unbound codes admit whoever redeems them first. Stored
values use the shared HMAC secret with the dedicated `auth.beta-invite.code`
purpose, not bare hashes vulnerable to offline enumeration. Collisions retry
without overwriting historical codes. Rotating the HMAC key invalidates unused codes.

Management uses constant-time digest comparison, 10 attempts/minute/IP and
30 authenticated operations/hour globally. Signup retains email/IP limits and
adds 120 supplied-code attempts/hour globally. These are process-local: run one
replica until the shared limiter is implemented. Configure trusted ingress IPs.
API security middleware applies no-store to responses. Do not log request bodies,
Authorization headers, plaintext invite codes, response bodies, or invite-link query strings at ingress.
Dashboard telemetry uses route templates, not invite query values.

`auth.beta_invite` retains issuance, expiry, recipient and terminal state;
`audit.beta_invite_events` appends created/revoked/redeemed facts in the same
transaction. Events reference the invite ID and contain no code/token. Failed
requests and idempotent revocations append no events. Existing user/workspace
audit events remain unchanged.

## Deployment and verification

Apply the generated migrations through normal startup. No wipe or backfill is
required. Set `AUTH_INVITE_REQUIRED=true` and the admin secret before admitting
testers. `false` intentionally enables open signup; use it only when explicitly
desired. Existing accounts are grandfathered in either mode.

HTTP tests cover admin authorization, guarded signup, expiry/revocation, optional
recipient binding, existing-user login, and competing redemption. Run the same
suite in the disposable PostgreSQL lane for production-driver concurrency.
Dashboard schema tests cover blank existing-user codes and malformed inputs.
