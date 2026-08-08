# TODOs

## Platform prerequisites before authentication

This section defines work that must precede or run alongside magic-link sign-in.
The feature-coding gate identifies the minimum foundation needed before starting
the workflow; every remaining item must be complete before production enablement.
The initial public topology is:

```text
https://dashboard.namera.ai  Browser application
            |
            | credentialed HTTPS requests
            v
https://api.namera.ai        Central API and authentication server
https://api.namera.ai/mcp    Future MCP resource endpoint
```

Use one logical API service initially, but keep it stateless and horizontally
deployable. `api.namera.ai` is the only browser-session authority. Future services
on other `*.namera.ai` hosts must not automatically receive its session cookie.

### Domain, DNS, TLS, and routing

- [ ] Configure production DNS for `api.namera.ai` and `dashboard.namera.ai`.
- [ ] Configure local, preview, staging, and production equivalents without sharing production cookies or secrets.
- [ ] Provision automatically renewed TLS certificates and redirect all HTTP traffic to HTTPS.
- [ ] Enable HSTS only after HTTPS works reliably on every production subdomain; assess `includeSubDomains` before enabling it.
- [ ] Route only explicitly configured hostnames; reject unknown `Host` values instead of forwarding arbitrary `*.namera.ai` traffic.
- [ ] Decide whether future subdomains use explicit DNS records or wildcard DNS; require an explicit application allowlist either way.
- [ ] Configure trusted reverse-proxy hops and reject spoofed forwarded host, protocol, and client-IP headers.
- [ ] Add `/livez` and `/readyz` endpoints that do not expose dependencies, credentials, or internal diagnostics.
- [ ] Add graceful shutdown, request deadlines, body-size limits, and connection limits to the API server.
- [ ] Document ownership, deployment, rollback, and incident procedures for the API and dashboard.

### Public URL and route policy

- [ ] Define typed configuration for `API_PUBLIC_ORIGIN=https://api.namera.ai` and `DASHBOARD_PUBLIC_ORIGIN=https://dashboard.namera.ai`.
- [ ] Generate all authentication links from `API_PUBLIC_ORIGIN`, never from request headers.
- [ ] Serve the magic-link landing and verification endpoints from `api.namera.ai` so that API can set its host-only session cookie directly.
- [ ] Define stable route namespaces for browser API, operational endpoints, OAuth metadata, webhooks, and `/mcp`.
- [ ] Reserve `/.well-known/` routes for standards-based discovery and prevent application catch-all routes from shadowing them.
- [ ] Keep health, metrics, administrative, and debugging endpoints off the public route surface or protect them independently.
- [ ] Define maximum request sizes and accepted content types per route group.

### Browser origin and CORS policy

- [ ] Create a central typed trusted-origin registry with exact origins, initially only `https://dashboard.namera.ai` in production.
- [ ] Use exact scheme, host, and port matching; do not trust origins through suffix, substring, regex-without-boundary, or `*.namera.ai` matching.
- [ ] Return `Access-Control-Allow-Origin: https://dashboard.namera.ai` for the allowed origin, never `*` on credentialed routes.
- [ ] Return `Access-Control-Allow-Credentials: true` and `Vary: Origin` on credentialed cross-origin responses.
- [ ] Allow only required methods and headers, and keep CORS preflight responses unauthenticated and side-effect free.
- [ ] Configure dashboard API requests with `credentials: "include"` in one shared HTTP client.
- [ ] Reject untrusted or missing origins on browser-only state-changing requests using an exact `Origin` policy.
- [ ] Require JSON and a custom application header on state-changing browser requests so they are preflighted.
- [ ] Add CSRF tokens for sensitive workflows or any route that cannot rely on the browser API policy alone.
- [ ] Add integration tests for accepted origin, rejected origin, `null` origin, preflight, missing credentials, and wildcard misconfiguration.
- [ ] Require security review before adding every future dashboard or `*.namera.ai` origin to the allowlist.

### Session boundary

- [ ] Finalize the session schema, expiration, idle timeout, absolute timeout, rotation, revocation, and cleanup policy.
- [ ] Use a host-only `__Host-namera-session` cookie set by `api.namera.ai` with `Secure`, `HttpOnly`, `Path=/`, and an explicit `SameSite` policy.
- [ ] Do not set `Domain=.namera.ai`; future subdomains must not receive the API session credential.
- [ ] Store only a digest of each session credential and use cryptographically secure random values.
- [ ] Rotate the session on authentication, privilege changes, account switching, and recovery events.
- [ ] Ensure the dashboard cannot read the session cookie and obtains current-user state through an authenticated API endpoint.
- [ ] Define logout-current-session, logout-all-sessions, revocation, and compromised-session behavior.
- [ ] Add `Cache-Control: no-store` to authentication and user-session responses.
- [ ] Test cookie behavior between dashboard and API in all supported browsers and deployed environments.
- [ ] Decide how future first-party web applications authenticate; prefer central API calls or explicit token exchange over shared parent-domain cookies.

### Effect application foundations

- [ ] Add repository instructions requiring contributors and agents to read Effect's local guidance before writing Effect code.
- [ ] Define validated, redacted configuration services for public origins, cookie policy, trusted origins, email, hashing secrets, and rate limits.
- [ ] Define provider-independent `EmailService`, `RateLimiter`, `Random`, `Hashing`, and telemetry service contracts.
- [ ] Provide separate live, test, local-development, and disabled layers for external services.
- [ ] Use Effect `Clock` for time-dependent policies and deterministic tests.
- [ ] Use class-based `Context.Service` declarations and named `Effect.fn` operations for application workflows.
- [ ] Define transaction boundaries in the application layer while keeping repositories usable with either the normal database or a transaction.
- [ ] Define typed internal infrastructure errors separately from safe protocol/HTTP errors.
- [ ] Add configuration-startup tests so production fails closed when a required origin, cookie, email, or secret setting is missing.

### Transactional email foundation

- [ ] Select a transactional email provider and document its availability, regional, retention, rate-limit, and cost requirements.
- [ ] Create a provider-independent Effect `EmailService` and a deterministic test layer before adding authentication email logic.
- [ ] Choose a dedicated transactional sending identity and separate it from future marketing email traffic.
- [ ] Configure the provider's DKIM records and envelope/return-path domain.
- [ ] Publish one valid SPF policy for each sending domain; do not create multiple competing SPF TXT records.
- [ ] Publish DMARC with aggregate reporting, monitor alignment, then plan progression from monitoring to quarantine or reject.
- [ ] Configure branded `From`, `Reply-To`, and bounce addresses with clear operational ownership.
- [ ] Add signed provider webhooks and verify signatures against the raw request body before decoding events.
- [ ] Persist webhook event IDs and make delivery, bounce, complaint, and suppression handling idempotent.
- [ ] Implement a transactional outbox so database commits do not depend on synchronous provider calls.
- [ ] Add an outbox worker with bounded retries, exponential backoff, jitter, idempotency keys, and a dead-letter policy.
- [ ] Define encrypted handling and short retention for any outbox payload that temporarily contains a raw authentication credential.
- [ ] Build reusable HTML and plain-text templates with accessible buttons, visible destination domains, and no tracking on authentication links.
- [ ] Add local email capture or a fake provider so development and tests never send real messages.
- [ ] Implement suppression, bounce, complaint, provider-outage, resend, and operator-recovery workflows.
- [ ] Add delivery metrics and alerts without logging recipient addresses, tokens, codes, or complete magic-link URLs.
- [ ] Send seed emails to major providers and verify SPF, DKIM, DMARC, rendering, links, spam placement, and delivery latency.

### Database and background processing foundation

- [ ] Finalize production migrations, migration locking, deployment ordering, rollback policy, backups, and restore testing.
- [ ] Add a durable job/outbox claiming strategy that prevents two workers from delivering the same job concurrently.
- [ ] Define worker leases, retry limits, poison-message handling, and graceful shutdown behavior.
- [ ] Ensure database and worker timestamps use a consistent authoritative time source.
- [ ] Add scheduled cleanup infrastructure for expired verifications, sessions, idempotency keys, and retained webhook events.
- [ ] Verify database transactions roll back application changes and outbox insertion together.
- [ ] Load-test connection pools for API and worker concurrency before production rollout.

### Secrets and operational security

- [ ] Store database, email-provider, webhook, session, HMAC, and observability credentials in a managed secret store.
- [ ] Use separate credentials and cryptographic keys for local, preview, staging, and production environments.
- [ ] Document key versioning and rotation that permits verification during a bounded migration window.
- [ ] Apply least-privilege database and provider credentials to API, migration, and worker processes.
- [ ] Prevent secrets and authentication URLs from entering source control, build output, logs, traces, analytics, and error reports.
- [ ] Add dependency, container, and secret scanning to CI.
- [ ] Define audit events for authentication requests, successful sign-ins, session revocation, rate limiting, and administrative actions.
- [ ] Define alert ownership and an incident runbook for credential leakage, email abuse, account takeover, and provider outage.

### Observability and abuse controls

- [ ] Add structured logging with request IDs and privacy-preserving correlation identifiers.
- [ ] Redact `Cookie`, `Authorization`, callback query strings, email credentials, codes, and sensitive request bodies at ingress.
- [ ] Add metrics for API latency, errors, saturation, database pools, outbox depth, provider delivery, and rate limiting.
- [ ] Add tracing boundaries around HTTP, application services, database transactions, outbox processing, and provider calls.
- [ ] Select a shared rate-limit backend that works across multiple API replicas and workers.
- [ ] Define limits by IP, subnet, normalized-identifier hash, route, and risk level with safe behavior when the backend is unavailable.
- [ ] Configure trusted client-IP extraction and test it behind the production proxy/CDN.
- [ ] Establish dashboards and alerts before enabling authentication for external users.

### Future MCP and subdomain isolation

- [ ] Reserve `https://api.namera.ai/mcp` as a distinct resource-server boundary even if it runs in the same deployment.
- [ ] Do not authenticate MCP clients with the browser session cookie or magic-link credential.
- [ ] Plan MCP authorization around bearer access tokens, OAuth protected-resource metadata, explicit scopes, token audience, and expiry.
- [ ] Reserve the required `/.well-known/oauth-protected-resource` discovery route and authorization-server metadata routes.
- [ ] Define independent rate limits, request-size limits, audit events, and authorization middleware for `/mcp`.
- [ ] Keep browser CORS configuration separate from MCP client authorization.
- [ ] Require explicit DNS, TLS, routing, origin, cookie, and threat-model review before enabling each new `*.namera.ai` service.
- [ ] Prefer service identities and short-lived audience-bound tokens for server-to-server calls instead of forwarding user cookies.

### Feature-coding start gate

- [ ] Public API, dashboard, callback, and safe post-authentication redirect origins are decided and represented by typed configuration.
- [ ] Exact trusted-origin, CORS, state-changing request, and host-only cookie policies are specified and covered by initial tests.
- [ ] Session creation, hashing, rotation, revocation, and transaction contracts are defined.
- [ ] Provider-independent email, outbox, rate-limit, random, hashing, clock, and configuration service contracts are defined.
- [ ] Transactional email provider and sending-domain strategy are selected.
- [ ] Verification and outbox data models, migrations, repository boundaries, and cleanup policies are designed.
- [ ] Public authentication errors, internal infrastructure errors, and redaction rules are defined.
- [ ] The magic-link implementation can start once every item in this gate is complete.

### Production-enablement gate

- [ ] Production and staging DNS, TLS, routing, health checks, and rollback are verified.
- [ ] Exact-origin credentialed CORS and state-changing request protection pass browser integration tests.
- [ ] Host-only session creation, use, rotation, revocation, and cleanup pass integration tests.
- [ ] Transactional email authentication, delivery, webhooks, outbox, retry, and suppression behavior are verified.
- [ ] Configuration, secrets, rate limiting, redaction, telemetry, dashboards, and alerts are operational.
- [ ] Backups and restore procedures have been exercised.
- [ ] The production architecture and authentication threat model have been reviewed.
- [ ] Only after every platform prerequisite and magic-link checklist item is complete, enable sign-in for production users.

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
