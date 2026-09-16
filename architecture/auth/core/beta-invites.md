# Private-beta admission

New accounts require an invite by default (`AUTH_INVITE_REQUIRED=true`). Existing
users retain normal email login. This gate runs in magic-link authentication,
not just the dashboard, so CLI and MCP consent cannot create an uninvited user.
Organization invitations do not bypass beta admission.

## Operator API

Set `ADMIN_TOKEN` to a randomly generated secret of at least 32 characters
in the server secret manager. Missing or shorter values disable management.
Generate a value with `openssl rand -hex 32`; never put it in frontend variables,
source control, URLs, telemetry, or shared shell history. Rotate it by changing
the secret and restarting the server. It authorizes routes explicitly protected by
`AdminAuthorization`, currently these two endpoints, not wallets or delegated operations.
See [platform admin authorization](../admin.md). A shared operator credential cannot identify
individual operators; keep distribution narrow and restrict these routes at ingress.

```sh
# Run from a trusted operator machine with the secret supplied securely.
curl --fail-with-body "$API_ORIGIN/internal/invites" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"count":6,"expiresInDays":7}'

# Revoke an unused invite using the ID returned at creation, not its code.
curl --fail-with-body -X DELETE "$API_ORIGIN/internal/invites/$INVITE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Creation accepts 1–50 invites, an optional 1–30-day lifetime (default seven), and
optional `email` binding. It returns `invites: [{id, code, url, expiresAt}]`.
Plaintext codes/links are returned only here; save them privately before sharing.
The link uses the configured dashboard origin: `/auth?invite=K7MP2X`.
Revocation returns `revoked: true` only for a new transition; missing, already
revoked or redeemed IDs return false. It does not remove an admitted user.

## Signup lifecycle

1. Everyone enters only their email, then verifies it using the email link or OTP.
   Requests return the same accepted response and send verification mail regardless
   of invite status. A code carried by `/auth?invite=CODE` is attached silently;
   only its matching invite ID is stored in the email challenge.
2. Existing users receive their normal session immediately. New users with a valid
   attached invite are admitted in the same transaction as email verification.
3. Other new users receive a restricted `beta-signup` HttpOnly cookie and the
   return destination `/auth/invite`. The email challenge is consumed, but no user,
   workspace, normal session, billing state, or sign-in notification is created.
4. That cookie references a `beta-admission` verification row containing email,
   approved return destination, and a purpose-separated token hash. It expires
   after ten minutes and survives page reloads. It cannot authenticate dashboard,
   wallet, CLI, or MCP operations and is scoped to `/auth/magic-link`.
5. `POST /auth/magic-link/redeem-invite` accepts `{inviteCode}` plus the restricted
   cookie. It validates the proof, invite, and recipient binding, then atomically
   consumes the proof and invite and creates the user/workspace/session. The server
   clears the restricted cookie and returns the original approved destination.
   Invalid invites return 403 and increment a five-attempt proof limit. Missing,
   expired, consumed, tampered, or exhausted proofs require email verification again.

Opening an invite or requesting email never consumes it. Revocation, expiry, or a
competing redemption prevents admission; two emails cannot claim the same invite.
An unusable attached code sends a verified new user to manual invite entry rather
than blocking email login. Subsequent login and CLI/MCP authorization need no invite.

## Security and persistence

Codes use six cryptographically random characters from
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (30 bits). They are admission credentials, not
email authentication. Unbound codes admit whoever redeems them first. Stored
values use the shared HMAC secret with the dedicated `auth.beta-invite.code`
purpose, not bare hashes vulnerable to offline enumeration. Collisions retry
without overwriting historical codes. Rotating the HMAC key invalidates unused codes.

Management uses constant-time digest comparison, 10 attempts/minute/IP and
30 authenticated operations/hour globally. Signup retains email/IP limits and
adds 120 supplied-code attempts/hour globally for each request/redemption route.
Redemption also uses the verification IP limit and five attempts per restricted proof.
These are process-local: run one
replica until the shared limiter is implemented. Configure trusted ingress IPs.
API security middleware applies no-store to responses. Do not log request bodies,
Authorization headers, plaintext invite codes, response bodies, or invite-link query strings at ingress.
Dashboard telemetry uses route templates, not invite query values.

`auth.beta_invite` retains issuance, expiry, recipient and terminal state;
`audit.beta_invite_events` appends created/revoked/redeemed facts in the same
transaction. Events reference the invite ID and contain no code/token. Failed
requests and idempotent revocations append no events. Pending email proofs use
the existing verification lifecycle, not an admitted-user audit event. Existing user/workspace
audit events remain unchanged.

## Deployment and verification

Apply the generated migrations through normal startup. No wipe or backfill is
required. Set `AUTH_INVITE_REQUIRED=true` and the admin secret before admitting
testers. `false` intentionally enables open signup; use it only when explicitly
desired. Existing accounts are grandfathered in either mode.

HTTP tests cover admin authorization, guarded signup, expiry/revocation, optional
recipient binding, existing-user login, restricted-cookie isolation, proof expiry,
attempt limits, and competing redemption. Run the same
suite in the disposable PostgreSQL lane for production-driver concurrency.
Dashboard schema tests cover blank existing-user codes and malformed inputs.
