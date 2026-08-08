# TODOs

## Magic-link authentication

The implementation contract is documented in
[`packages/application/MAGIC_LINK.md`](packages/application/MAGIC_LINK.md).

### Design and protocol

- [ ] Confirm whether verified emails may create new users or only sign in existing users.
- [ ] Define branded magic-link request, link-verification, and code-verification schemas.
- [ ] Replace detailed public token errors with `INVALID_OR_EXPIRED_LINK`, `TOO_MANY_ATTEMPTS`, and `SIGN_IN_NOT_ALLOWED`.
- [ ] Define and test the allowlisted relative `returnTo` policy.
- [ ] Add validated magic-link configuration and secret handling.

### Database

- [ ] Add purpose, token hash, code hash, attempts, consumed time, and safe return path to verification persistence.
- [ ] Add indexes for selector lookup, outstanding email verification, and expiration cleanup.
- [ ] Add repository operations for issuing, invalidating, finding, incrementing attempts, consuming, and cleaning verifications.
- [ ] Implement conditional, single-use verification consumption.
- [ ] Add an email outbox table and idempotent delivery records.
- [ ] Add a retention job for expired and consumed verification records.

### Application services

- [ ] Implement the class-based `MagicLinkService` and live layer.
- [ ] Use Effect `Clock`, named `Effect.fn` operations, spans, and safe log annotations.
- [ ] Implement layered request and verification rate limiting.
- [ ] Implement secure link-secret and eight-digit code generation.
- [ ] Store only token/code digests and use timing-safe comparisons.
- [ ] Implement resend invalidation and request cooldown behavior.
- [ ] Atomically consume verification, find/create the user, verify email, and create the session.
- [ ] Define behavior for disabled users, existing sessions, and account switching.

### API and user experience

- [ ] Add the generic `POST /auth/magic-link/request` endpoint.
- [ ] Add the non-consuming `GET /auth/magic-link` confirmation page.
- [ ] Add `POST /auth/magic-link/verify` for link and code verification.
- [ ] Add no-store, no-referrer, CSP, framing, and content-type security headers.
- [ ] Remove credentials from the browser URL before rendering additional content.
- [ ] Set a fresh `__Host-namera-session` cookie only after transaction commit.
- [ ] Redirect with `303 See Other` to a server-validated relative path.
- [ ] Add resend, expired-link, invalid-code, and account-switch user interfaces.
- [ ] Keep invitation acceptance and other authorization changes separate from authentication.

### Email delivery

- [ ] Implement an idempotent email-outbox worker with bounded retries.
- [ ] Create the branded link-and-code email template.
- [ ] Configure and verify SPF, DKIM, and DMARC for the transactional domain.
- [ ] Handle bounces, suppressions, provider outages, and resend behavior.
- [ ] Ensure provider payloads and events do not retain credentials unnecessarily.

### Security and privacy

- [ ] Redact callback query strings, tokens, codes, sessions, and sensitive PII from logs, traces, proxies, and error reporting.
- [ ] Confirm public responses and timings do not disclose account existence.
- [ ] Verify email scanners cannot consume credentials with a `GET` request.
- [ ] Add protection against replay, brute force, redirect abuse, session fixation, and concurrent consumption.
- [ ] Require step-up authentication for high-risk account and authorization changes.
- [ ] Document HMAC-secret rotation and incident-response procedures.

### Testing and rollout

- [ ] Add unit tests for normalization, redirects, expiry, attempts, hashing, and public error mapping.
- [ ] Add database tests for resend invalidation, atomic consumption, concurrency, and rollback.
- [ ] Add API tests for non-consuming GET, POST verification, headers, cookies, and redirects.
- [ ] Add cross-device, two-tab, expired-page, disabled-user, and existing-session tests.
- [ ] Test outbox idempotency, retry behavior, bounce handling, and log redaction.
- [ ] Add request, delivery, verification, replay, expiration, and rate-limit metrics.
- [ ] Add alerts for provider failures, abuse, replay spikes, and conversion drops.
- [ ] Roll out behind a feature flag to internal users before gradual production enablement.
- [ ] Document the supported recovery path for email-delivery failures.
