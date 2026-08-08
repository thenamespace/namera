# Production Magic-Link Authentication

This document defines the production implementation plan for passwordless email
authentication in Namera. It is an implementation contract for the application,
API, database, protocol, and infrastructure packages.

The recommended design is a hybrid email credential:

- a magic-link button;
- an eight-digit one-time code as a fallback;
- a ten-minute lifetime;
- five code attempts;
- only the latest request for an email remains valid;
- an initial `GET` never authenticates or consumes the credential;
- a deliberate `POST` atomically consumes the credential and creates a session.

The code fallback and non-consuming landing page protect the user experience from
email-security products that automatically visit links before the recipient does.

## Security properties

The implementation must guarantee all of the following:

1. Requesting a link does not reveal whether an account exists.
2. Raw link tokens, codes, and session tokens are never stored or logged.
3. A verification can be used only once, including under concurrent requests.
4. Authentication is performed only by a state-changing `POST` request.
5. Redirect destinations cannot leave the application allowlist.
6. Successful verification always creates a new session identifier.
7. Email verification proves control of an address but does not grant organization
   membership, elevated permissions, or approval for a high-risk action.
8. User creation, verification consumption, and session creation are atomic.

Anyone possessing the email credential can sign in as its intended user until it
expires or is consumed. Treat the email content as a temporary password.

## System boundaries

### Protocol package

Owns public request and response schemas, branded identifiers, and errors that are
safe to expose over HTTP.

### Database package

Owns verification, user, session, and email-outbox persistence. It provides small
repository operations but does not coordinate the complete sign-in use case.

### Application package

Owns the `MagicLinkService` workflow, policy, transaction boundaries, rate-limit
decisions, email-delivery worker program, and mapping from internal failures to
public errors.

### Emails package

`@namera-ai/emails` owns a closed, typed hosted-template registry, `EmailService`,
the Resend adapter, webhook signature verification, and provider-error mapping. A
template `type` determines its exact variables at compile time. The package does not
decide when a magic link should be issued or coordinate authentication state.

### API package

Owns HTTP routes, session cookies, and request decoding. Route handlers delegate
business behavior to `MagicLinkService`.

### Dashboard application

Owns the non-consuming magic-link landing page, confirmation UI, page security
headers, credential removal from the browser URL, and navigation after sign-in.

### Server application

`apps/server` is the composition root. It reads and validates environment variables,
selects the Resend, database, rate-limit, encryption, and OpenTelemetry live layers,
provides them to the application and API layers, and launches the HTTP server and
application background programs. It contains no authentication business rules.

## Data model

Use shared columns for verification lifecycle and security state, with JSON data
for the context specific to each purpose.

```ts
interface MagicLinkVerificationRecord {
  readonly id: VerificationId;
  readonly purpose: "magic-link-signin";
  readonly identifier: Email;
  readonly data: {
    readonly returnTo?: string;
  };
  readonly tokenHash: string;
  readonly codeHmac: string;
  readonly attempts: number;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}
```

Requirements:

- `id` is an opaque selector, preferably UUIDv7.
- `identifier` contains the normalized email produced by the protocol schema.
- `tokenHash` and `codeHmac` contain hashes or keyed hashes, never plaintext.
- `purpose` prevents a token issued for one workflow from being used by another.
- `data` contains only purpose-specific context. For magic-link sign-in,
  `data.returnTo` is an optional validated application-relative path.
- `consumedAt` supports replay detection and audit; it is set exactly once.
- expired and consumed records are removed later by a scheduled retention job.
- indexes support selector lookup, outstanding verification lookup by normalized
  email and purpose, and expiration cleanup.

The email outbox record should include a stable idempotency key derived from the
verification ID. Do not place raw tokens or codes in durable logs or generic event
payloads. If the worker requires the plaintext credential, encrypt the payload with
a narrowly scoped key and delete it after delivery, or dispatch it after commit via
a secure job system that does not retain job bodies indefinitely.

## Credential generation

Generate credentials using a cryptographically secure random-number generator:

- link secret: 32 random bytes, encoded with base64url;
- code: uniformly generated eight-digit value, including leading zeroes;
- link format: `<verification-id>.<secret>`.

Hash the secret and code independently. A keyed HMAC using a dedicated rotating
server secret is preferred for short numeric codes because their search space is
small. Compare digests with a timing-safe equality operation.

Environment configuration must provide:

```text
AUTH_API_PUBLIC_ORIGIN
AUTH_DASHBOARD_PUBLIC_ORIGIN
```

The remaining magic-link and session policy is defined in application code.
Construct email links from `AUTH_DASHBOARD_PUBLIC_ORIGIN`, never from `Host`,
`Forwarded`, or `X-Forwarded-Host` request headers.

## Application services

The central workflow should follow the repository's class-based Effect service
convention.

```ts
export interface MagicLinkServiceShape {
  readonly request: (input: MagicLinkRequest) => Effect.Effect<void, MagicLinkRequestError>;

  readonly verify: (
    input: MagicLinkVerification,
  ) => Effect.Effect<AuthenticatedSession, MagicLinkVerificationError>;
}

export class MagicLinkService extends Context.Service<MagicLinkService, MagicLinkServiceShape>()(
  "@namera-ai/application/MagicLinkService",
) {
  static readonly layer = Layer.effect(/* implementation */);
}
```

Expected dependencies:

- `VerificationRepository`;
- `UserRepository`;
- `SessionRepository`;
- `Transaction`;
- `EmailOutboxRepository`;
- `RateLimiter`;
- cryptographic random and hashing services;
- Effect `Clock`;
- validated authentication configuration.

`MagicLinkService` must not call Resend directly. A separate application
`EmailDeliveryWorker` depends on `EmailOutboxRepository`, encryption, `EmailService`,
`Clock`, and retry policy. This keeps the request transaction short and makes email
delivery durable and independently testable.

Use `Effect.fn` for named operations and spans. Use `Clock` rather than `Date.now()`
so expiration behavior is deterministic in tests. Annotate telemetry with a
request or trace identifier and safe outcome fields, never the verification
selector, email, token, code, or session credential.

### Effect workflow decision

Use ordinary request-scoped Effects for requesting and verifying a magic link. Use
the database outbox and an Effect background worker with schedules, leases, and
bounded retry for email delivery. Do not create one durable workflow that waits for
the user to open the email: verification is a later independent HTTP request
correlated through the verification record.

Do not add `@effect/workflow` for the initial implementation. Reassess it only when
Namera has long-running multi-step processes that must suspend and resume across
process restarts, such as approval chains or timed onboarding sequences.

Suggested repository operations:

```ts
createMagicLink;
invalidatePendingForEmail;
findMagicLinkById;
findMagicLinkByEmail;
incrementAttempts;
consumeMagicLink;
deleteExpiredVerifications;
```

## Request flow

### HTTP contract

```http
POST /auth/magic-link/request
Content-Type: application/json

{
  "email": "user@example.com",
  "returnTo": "/dashboard"
}
```

The endpoint should return `202 Accepted` with the same body for existing,
unknown, disabled, and temporarily undeliverable addresses:

```json
{
  "message": "If this email can sign in, we sent a sign-in email."
}
```

### Processing steps

1. Decode and normalize the email through the protocol schema.
2. Accept only a known application-relative `returnTo`; otherwise use the default.
3. Apply layered limits by normalized-email hash, IP, and subnet. Introduce a
   challenge or stronger throttling when abuse signals exceed policy.
4. Preserve a reasonably uniform observable response and timing for known and
   unknown accounts.
5. If sign-up is disabled and the user is not eligible, perform no delivery but
   return the generic response.
6. Generate the selector, link secret, and numeric code.
7. In one short database transaction, invalidate prior outstanding credentials for
   the email and purpose, insert the new verification, and insert an outbox job.
8. Commit before performing any network call to an email provider.
9. Let the worker deliver the message with a stable idempotency key and bounded
   retries.

Starting rate limits, to be tuned from production data:

- one request per email per minute;
- three requests per email per fifteen minutes;
- ten requests per IP per hour;
- five verification attempts per issued credential.

Rate-limit rejection must still avoid confirming account existence.

If sign-up is supported, create the user only after successful verification. A
request alone does not prove control of the address and should not create junk
accounts.

## Email contents and delivery

The email should contain:

- a clearly branded sign-in button;
- the eight-digit fallback code;
- the expiration time;
- a statement that the credential should not be forwarded;
- a statement that no action is needed if the recipient did not request it;
- the expected product and domain so phishing is easier to identify.

Use Resend through the typed hosted-template email service and pass the outbox
idempotency key on every send. Track provider delivery events without putting
credentials in event metadata. Handle bounces and suppression-list responses, and
expose resend behavior in the UI.

## Link landing flow

The email button opens a minimal page owned by the dashboard application:

```http
GET https://dashboard.namera.ai/auth/magic-link?id=<selector>&token=<secret>
```

This page must not call the verification endpoint automatically. It renders a
confirmation action, and only an explicit user action performs the verification
`POST`. This protects ordinary users from link-prefetching and email-scanning
systems.

The landing response must use at least:

```http
Cache-Control: no-store
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; form-action 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

Do not include analytics, third-party scripts, pixels, external fonts, or resource
URLs that could receive a referrer. Capture the token for the form and immediately
remove it from the visible browser URL with `history.replaceState`.

The page should require an explicit **Continue signing in** action. That action
posts the credential to `https://api.namera.ai/auth/magic-link/verify`. On success,
the API sets the HttpOnly session cookie and the dashboard navigates to the validated
return path. Do not bind the credential to the browser that requested it: users
frequently request on one device and open email on another.

## Verification flow

### HTTP contracts

Link verification:

```http
POST /auth/magic-link/verify
Content-Type: application/json

{
  "type": "token",
  "id": "<selector>",
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

Apply attempt limits before expensive work. For a code mismatch, atomically
increment `attempts`; invalidate the credential once the maximum is reached.

### Atomic transaction

After checking the submitted digest, run these operations in one database
transaction:

1. select the verification for its exact purpose;
2. confirm it is unconsumed, unexpired, and below the attempt limit;
3. atomically set `consumedAt` with a conditional update and require one returned
   row;
4. find the eligible user, or create one if verified-email sign-up is enabled;
5. set `emailVerified` and update `lastLoginAt`;
6. create a fresh session record;
7. commit the transaction.

The consume operation must be equivalent to:

```sql
UPDATE verification
SET consumed_at = now()
WHERE id = $1
  AND purpose = 'magic-link-signin'
  AND consumed_at IS NULL
  AND expires_at > now()
RETURNING *;
```

Exactly one concurrent caller can receive the row. If creating the user or session
fails, the transaction rolls back so the verification is not accidentally burned.

## Session and redirect behavior

Only after the transaction commits should the API attach the new session cookie:

```http
Set-Cookie: __Host-namera-session=<credential>; Path=/; Secure; HttpOnly; SameSite=Lax
Cache-Control: no-store
```

Store only the session credential hash in the database where practical. Never reuse
an anonymous or existing session identifier; mint a new cryptographically random
credential to prevent session fixation.

Return a `303 See Other` redirect to the server-stored, allowlisted relative path.
The final URL must not contain the selector, token, code, or session credential.

If the browser already has a session:

- for the same user, rotate or replace the session according to session policy;
- for a different user, require an explicit account-switch confirmation rather
  than silently changing identities.

## Error model

Public errors should not distinguish a missing token from a malformed, expired, or
already-consumed token. A safe public model is:

```ts
type MagicLinkPublicCode = "INVALID_OR_EXPIRED_LINK" | "TOO_MANY_ATTEMPTS" | "SIGN_IN_NOT_ALLOWED";
```

Keep operational failures internal and observable:

```text
EmailDeliveryError
VerificationNotFound
VerificationExpired
VerificationConsumed
VerificationDigestMismatch
VerificationPersistenceError
SessionCreationError
```

The request endpoint normally returns its generic accepted response even if the
provider later rejects the email. Alert operators and offer the user a resend path;
do not expose delivery internals that create an account-existence oracle.

## Authorization boundaries

Successful magic-link verification authenticates the user and verifies the email.
It must not implicitly:

- accept an organization invitation;
- add organization membership;
- link an OAuth identity merely because email strings match;
- change a recovery address;
- approve wallet, billing, payout, or permission changes;
- bypass a required passkey, MFA, or other step-up policy.

Store invitation or organization context as server-side state, authenticate first,
and perform the requested authorization-changing action separately and explicitly.

## Edge cases

| Case                                       | Required behavior                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| Scanner opens the email URL                | Render the landing page; do not consume anything.                        |
| User opens two tabs                        | The first verification wins; the second is invalid or already signed in. |
| Two requests verify concurrently           | Conditional consumption creates exactly one session.                     |
| User resends                               | Revoke previous outstanding credentials and apply cooldown.              |
| User opens email on another device         | Permit verification; do not require the initiating browser.              |
| Credential expires while page is open      | Reject the POST and offer a new generic request flow.                    |
| User is deleted or disabled after issuance | Fail safely without revealing account state.                             |
| Existing session belongs to another user   | Require confirmation before switching accounts.                          |
| Invalid or external return path            | Ignore it and redirect to the safe default.                              |
| Email is forwarded                         | Whoever possesses it can sign in; communicate that it is sensitive.      |
| Provider retries delivery                  | Use the same credential and idempotency key.                             |
| Session insert fails                       | Roll back verification consumption and user changes.                     |
| Organization invitation is present         | Authenticate first; accept the invitation separately.                    |
| Account requires stronger authentication   | Continue into an MFA or passkey challenge.                               |

## Observability and privacy

Record metrics for:

- requests accepted and rate-limited;
- outbox jobs queued, delivered, retried, bounced, and suppressed;
- verification success by link or code;
- invalid, expired, replayed, and attempt-limited verifications;
- transaction failures and session-creation failures;
- request-to-verification latency.

Logs and traces must never contain raw email credentials, codes, session tokens, or
complete callback URLs. Prefer purpose-specific event names and salted hashes for
email correlation. Configure reverse proxies, APM tools, and error reporters to
redact the callback query string.

Create alerts for sustained delivery failures, abnormal request volume, elevated
invalid-code attempts, unexpected replay rates, and sudden verification-conversion
drops.

## Testing strategy

### Unit tests

- email normalization and return-path allowlisting;
- secure token and code generation boundaries;
- digest comparison and attempt policy;
- expiration using a test `Clock`;
- public error mapping;
- generic request behavior for eligible and ineligible users.

### Repository and transaction tests

- raw credentials are never persisted;
- resending invalidates the previous verification;
- exactly one of two concurrent consumers succeeds;
- failed user or session creation rolls back consumption;
- attempt increments and lockout are atomic;
- expired-record cleanup respects retention policy.

### API tests

- landing `GET` performs no database mutation;
- verification requires `POST`;
- security and no-store headers are present;
- cookie name and flags are correct;
- successful response is a `303` to an allowlisted path;
- tokens do not appear in the final URL or response body;
- invalid external redirects are rejected;
- cross-device verification succeeds;
- a different existing user session requires account-switch confirmation.

### Infrastructure tests

- outbox delivery is idempotent;
- retries do not create new credentials;
- provider payloads and webhooks contain no unnecessary secrets;
- SPF, DKIM, and DMARC pass in the production domain;
- logs, traces, proxy access logs, and error reports redact credentials.

## Rollout

1. Ship schema and repository changes without exposing routes.
2. Deploy the outbox worker and verify delivery-domain configuration.
3. Enable request and verification endpoints in a non-production environment.
4. Run concurrency, expiry, scanner-GET, redirect, and log-redaction tests.
5. Enable for internal accounts behind a feature flag.
6. Monitor delivery, verification conversion, replay, and rate-limit metrics.
7. Expand gradually while keeping an alternative sign-in or recovery path.
8. Document operational procedures for provider outages, abuse, and key rotation.

## Production completion criteria

The feature is production-ready only when:

- all security properties in this document are enforced by tests;
- both link and code verification work across devices;
- the initial `GET` cannot authenticate;
- consumption and session creation are atomic;
- credentials are redacted throughout logs and telemetry;
- delivery authentication and bounce handling are verified;
- abuse limits and alerts are active;
- key rotation and provider-outage procedures are documented;
- a user has a supported recovery path if email delivery is unavailable.

## References

- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [WorkOS Magic Link guidance](https://workos.com/docs/magic-link)
- [Microsoft Defender Safe Links](https://learn.microsoft.com/en-us/defender-office-365/safe-links-about)
