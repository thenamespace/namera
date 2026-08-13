# Magic-link authentication

This document is the stable implementation contract for Namera's passwordless
email authentication. Current completion and remaining work are tracked in the
repository-local `progress/magic-link.md` file.

## Product flow

Namera uses a hybrid email credential:

- a 32-byte random link token;
- an eight-digit fallback code;
- a ten-minute lifetime;
- five failed code attempts;
- a one-minute resend cooldown;
- only the latest pending credential for an email remains valid.

The email opens the dashboard at `/auth/verify?id=<id>&token=<token>`. Loading
that page must not consume the credential. The user explicitly confirms sign-in,
and the dashboard then sends a `POST` verification request. This prevents email
scanners and link previewers from creating sessions.

## Ownership

- `protocol` owns request, response, model, and public error schemas.
- `database` owns verification, user, session, organization, role, membership,
  actor, and audit persistence.
- `emails` owns the typed durable job service, Resend adapter, and worker.
- `application` owns request and verification workflows and their transactions.
- `api` owns the declarative `HttpApi` endpoints.
- `apps/server` owns rate limits, cookies, CORS, authorization, headers, and
  live layer composition.
- `apps/dashboard` owns the non-consuming confirmation and code-entry UI.

## Request

```http
POST /auth/magic-link/request
Content-Type: application/json

{
  "email": "user@example.com",
  "returnTo": "/"
}
```

The endpoint always returns `202 Accepted`, `Cache-Control: no-store`, and the
same enumeration-resistant response:

```json
{
  "message": "If this email can sign in, we sent a sign-in email."
}
```

The server applies global, per-IP, and normalized-email limits. The application
then:

1. respects the resend cooldown without revealing whether the user exists;
2. generates the token and code with cryptographic randomness;
3. stores a purpose-separated token hash and code HMAC, never plaintext;
4. revokes earlier pending sign-in verifications, inserts the new one, and
   enqueues the encrypted `magic-link` email job in one transaction;
5. uses the verification ID as the email idempotency key and the verification
   expiry as the delivery deadline;
6. returns after commit without waiting for Resend.

The server worker delivers the job with bounded retries and stale-lease
recovery. A permanent provider failure does not revoke the credential; it
expires normally and remains safe because no plaintext credential is persisted.

## Verification

Link verification:

```http
POST /auth/magic-link/verify
Content-Type: application/json

{
  "type": "token",
  "id": "<verification-id>",
  "token": "<secret>"
}
```

Code verification:

```http
POST /auth/magic-link/verify
Content-Type: application/json

{
  "type": "code",
  "email": "user@example.com",
  "code": "01234567"
}
```

The server applies the verification IP limit. The application rejects expired,
revoked, consumed, or purpose-mismatched records through the same public error.
Failed code checks increment attempts atomically and lock the credential at the
configured maximum.

Successful verification runs one transaction that:

1. conditionally consumes the verification so only one concurrent caller wins;
2. finds or creates the normalized-email user;
3. creates the user's Personal organization, system-role references, user actor,
   and owner membership when initialization is needed;
4. marks the email verified and records the login time;
5. ensures the user has an active organization;
6. stores only the fresh session-token hash;
7. appends the appropriate user and organization audit events;
8. records a new-sign-in notification and, when email preferences allow it,
   enqueues a durable security email containing the captured client context.

After commit, the server sets the raw credential in the `auth-token` cookie and
returns the stored application-relative `returnTo` value. The cookie is
`HttpOnly`, `Secure`, `SameSite=Lax`, and scoped to `/`. The response uses
`Cache-Control: no-store`.

## Security invariants

- Request responses do not disclose account existence or provider delivery
  failures, and do not wait for provider delivery.
- Raw verification tokens, codes, and session tokens are never persisted.
- Only a state-changing `POST` can consume a credential.
- Consumption and session creation are atomic and single-use.
- Authentication does not accept invitations or authorize wallet, role,
  membership, or billing changes.
- Return paths must remain application-relative and must be restricted to the
  configured allowlist before navigation.
- Shared and production logs, metrics, traces, and audit data must not contain
  email addresses, credentials, callback URLs, or other unbounded identifiers.
- The local development email layer may log template variables for explicit
  developer testing; it must never be selected in shared or production
  environments.

## Browser requirements

The verification page must require explicit confirmation and remove credentials
from the visible URL after capturing them. It should send a strict referrer
policy, content security policy, frame protection, and `Cache-Control: no-store`.
Frontend navigation is UX only; the server remains authoritative.

## Public errors

Verification exposes only the typed `MagicLinkError` codes:

- `INVALID_OR_EXPIRED_LINK` (`400`);
- `TOO_MANY_ATTEMPTS` (`429`).

Database and provider defects remain internal. Do not add public distinctions
for missing, consumed, revoked, or malformed credentials.

## References

- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Microsoft Defender Safe Links](https://learn.microsoft.com/en-us/defender-office-365/safe-links-about)
