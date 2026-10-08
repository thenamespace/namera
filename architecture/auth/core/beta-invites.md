# Private-beta admission

New accounts require an invite by default (`AUTH_INVITE_REQUIRED=true`). Existing
users retain normal email login. This gate runs in magic-link authentication,
and Google sign-in, not just the dashboard, so CLI and MCP consent cannot create an uninvited user.
Organization invitations do not bypass beta admission.

Active platform-team invitations are a narrow exception: after proving the
invited mailbox, a user may sign up normally, but must separately accept the
single-use team invitation to obtain any admin authority.

## Management

The admin portal implements three internal, OpenAPI-excluded endpoints:

- `GET /internal/invites`: all active admin roles; newest-first UUIDv7 cursor
  pagination (default 50, maximum 100), derived status and literal, case-insensitive
  bound-email substring filters. Returns display-safe fields and the redeemer's
  name/image/email, never codes or HMACs.
- `POST /internal/invites`: owner/operator; count 1–50, optional expiry 1–30 days
  (default seven). Optional normalized email binding is accepted only for count=1;
  batches with an email are rejected. Codes and dashboard join URLs are returned
  once. No email is sent automatically.
- `DELETE /internal/invites/:id`: owner/operator; active codes only. Missing,
  expired, redeemed or already-revoked codes return `{ revoked: false }`.

Writes require an active verified session and approved Origin, take the team lock,
recheck permission, and share a transaction with both invite and platform audit
events. Generation retries random-code collisions without overwriting old codes;
the complete batch commits or rolls back. Revocation and redemption use
conditional writes/row locking to prevent two terminal states. Existing invites
remain redeemable subject to expiry, recipient binding and terminal state. See
[platform admin authorization](../admin.md).

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

Existing codes contain six cryptographically random characters from
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (30 bits). They are admission credentials, not
email authentication. Unbound codes admit whoever redeems them first. Stored
values use the shared HMAC secret with the dedicated `auth.beta-invite.code`
purpose, not bare hashes vulnerable to offline enumeration. Rotating the HMAC key
invalidates unused codes.

Signup retains email/IP limits and
adds 120 supplied-code attempts/hour globally for each request/redemption route.
Redemption also uses the verification IP limit and five attempts per restricted proof.
These are process-local: run one
replica until the shared limiter is implemented. Ingress must overwrite forwarded
IP headers and block direct origin access.
API security middleware applies no-store to responses. Do not log request bodies,
Authorization headers, plaintext invite codes, response bodies, or invite-link query strings at ingress.
Dashboard telemetry uses route templates, not invite query values.

`auth.beta_invite` retains issuance, expiry, recipient and terminal state;
`audit.beta_invite_events` appends created/revoked facts in management transactions
and redeemed facts in the admission transaction. Events reference the invite ID and
contain no code/token. Failed redemptions append no events. Pending email proofs use
the existing verification lifecycle, not an admitted-user audit event. Existing user/workspace
audit events remain unchanged.

## Deployment and verification

Committed transitions increment `namera.beta_invite.transitions` with
`result=created|revoked|redeemed`. Batch creation counts each code; failed
transactions and no-op revocations do not increment it. Codes, recipient
addresses, and invite IDs never become metric attributes.

Apply the generated migrations through normal startup. No wipe or backfill is
required. Set `AUTH_INVITE_REQUIRED=true` to admit testers with existing valid
invites or create codes through the admin portal. `false` intentionally enables open signup; use it only when explicitly
desired. Existing accounts are grandfathered in either mode.

Management HTTP tests cover authorization, origin, session validity, creation, batch
binding rejection, safe projections, audit, filtering, pagination and competing
revocation/redemption. Admin form tests cover input boundaries and permission
gates. Admission HTTP tests seed existing invites directly and cover guarded signup, expiry/revocation, optional
recipient binding, existing-user login, restricted-cookie isolation, proof expiry,
attempt limits, and competing redemption. Run the same
suite in the disposable PostgreSQL lane for production-driver concurrency.
Dashboard schema tests cover blank existing-user codes and malformed inputs.
