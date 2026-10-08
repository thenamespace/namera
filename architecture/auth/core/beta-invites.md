# Private-beta admission

New accounts require an invite by default (`AUTH_INVITE_REQUIRED=true`). Existing
users retain normal email login. This gate runs in magic-link authentication,
and Google sign-in, not just the dashboard, so CLI and MCP consent cannot create an uninvited user.
Organization invitations do not bypass beta admission.

Active platform-team invitations are a narrow exception: after proving the
invited mailbox, a user may sign up normally, but must separately accept the
single-use team invitation to obtain any admin authority.

## Management status

The internal invite list/create/revoke API has been removed for the admin portal
rebuild. There is currently no supported invite issuance or revocation endpoint.
Existing invites remain redeemable, subject to expiry, recipient binding, and
terminal state. Admin authentication and team management are unchanged; see
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
`audit.beta_invite_events` retains historical created/revoked facts and appends
redeemed facts in the admission transaction. Events reference the invite ID and
contain no code/token. Failed redemptions append no events. Pending email proofs use
the existing verification lifecycle, not an admitted-user audit event. Existing user/workspace
audit events remain unchanged.

## Deployment and verification

Committed redemptions increment `namera.beta_invite.transitions` with
`result=redeemed`. Issuance/revocation emitters are removed. Codes, recipient
addresses, and invite IDs never become metric attributes.

Apply the generated migrations through normal startup. No wipe or backfill is
required. Set `AUTH_INVITE_REQUIRED=true` to admit testers with existing valid
invites. New invite issuance awaits the replacement management workflow. `false` intentionally enables open signup; use it only when explicitly
desired. Existing accounts are grandfathered in either mode.

HTTP tests seed existing invites directly and cover guarded signup, expiry/revocation, optional
recipient binding, existing-user login, restricted-cookie isolation, proof expiry,
attempt limits, and competing redemption. Run the same
suite in the disposable PostgreSQL lane for production-driver concurrency.
Dashboard schema tests cover blank existing-user codes and malformed inputs.
