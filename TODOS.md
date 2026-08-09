# TODOs

## Backend

### Magic link

The backend magic-link flow is implemented. It creates verified users, their
Personal organization and owner membership, then creates a fresh session in the
same transaction. The session cookie is intentionally named `auth-token`.

- [x] Implement request and single-use token/code verification workflows.
- [x] Store only token, code, and session digests.
- [x] Create the user, Personal organization, system roles, owner membership, and session atomically.
- [x] Return a generic `202 Accepted` response and `Cache-Control: no-store` from magic-link endpoints.
- [x] Add safe logs, traces, and low-cardinality authentication metrics.
- [ ] Enforce the configured allowlist for `returnTo` paths.
- [ ] Add request and verification rate limiting.
- [ ] Add retention cleanup for old verification and session records.

### Emails

- [x] Keep development email delivery silent so credentials and recipient data are not logged.
- [ ] Configure and verify the production Resend magic-link template.
- [ ] Add durable email delivery with idempotency and bounded retries before production.

## Dashboard — future

### Magic link

- [ ] Build the non-consuming magic-link confirmation and code-entry page.
- [ ] Remove credentials from the browser URL and apply strict page security headers.
- [ ] Add resend, expiration, invalid-code, and account-switch experiences.

## Quality

### Magic link

- [ ] Add focused unit, database, API, and end-to-end tests after the dashboard flow is implemented.
- [ ] Run a final security review covering replay, concurrent consumption, redirect handling, cookies, rate limits, and credential redaction.
