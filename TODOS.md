# TODOs

## Code foundations before magic-link authentication

The application package is the use-case and composition boundary. Packages below
it provide contracts or adapters; `apps/server` is the only composition root that
reads environment variables and provides production layers.

```text
apps/server
  └── provides config, runtime, telemetry, database, Resend, and worker layers
        ├── packages/api           HTTP routes and cookies
        └── packages/application   use cases and background programs
              ├── packages/database
              ├── packages/email
              ├── packages/protocol
              └── packages/utils
```

Dependency direction must remain one-way. `application` must not import `api` or
`apps/server`, and infrastructure packages must not import application services.

### Workspace structure

- [ ] Finish and commit the `@namera-ai/application` package scaffold.
- [ ] Create `@namera-ai/email` for the provider-independent email service, templates, and Resend adapter.
- [ ] Create `apps/server` as the Node runtime and production Layer composition root.
- [ ] Add explicit package exports and `namera-source` development conditions for the new packages.
- [ ] Add package references only where required by the repository TypeScript build strategy.
- [ ] Add `application`, `email`, and `server` tasks to Turbo build, typecheck, lint, and test pipelines.
- [ ] Add architecture tests or dependency rules that prevent reverse imports and package cycles.

### Protocol contracts

- [ ] Define branded `MagicLinkRequestId`, `MagicLinkToken`, and `MagicLinkCode` schemas without exposing persistence details.
- [ ] Define request-email, verify-link, and verify-code DTOs as readonly Effect schemas.
- [ ] Define public responses that do not reveal whether an email belongs to a user.
- [ ] Replace detailed public token failures with `INVALID_OR_EXPIRED_LINK`, `TOO_MANY_ATTEMPTS`, and `SIGN_IN_NOT_ALLOWED`.
- [ ] Keep Resend, outbox, hashing, database, and tracing errors out of the public protocol package.
- [ ] Define a safe relative `ReturnTo` schema and reject absolute, protocol-relative, and malformed paths.

### Application configuration

- [ ] Define an `AuthConfig` service in `packages/application` containing already-validated runtime values.
- [ ] Include magic-link TTL, code-attempt limit, resend cooldown, session TTL, cookie name, API public origin, dashboard return path, and allowed return paths.
- [ ] Represent secrets with `Redacted` values and keep token-HMAC and outbox-encryption keys separate.
- [ ] Do not call `Config.*`, `process.env`, or Node environment APIs inside application use cases.
- [ ] Create the production `AuthConfig.layer` in `apps/server` by decoding environment variables once at startup.
- [ ] Create deterministic test configuration with short TTLs and fixed safe origins.
- [ ] Fail server startup when required configuration is missing or invalid.

Suggested ownership:

```text
packages/application  AuthConfig contract and validated value type
packages/email        EmailConfig and ResendConfig contracts
apps/server           Config decoding and live Layer construction
```

### Email package and Resend adapter

- [ ] Define an `EmailService` using the repository's class-based `Context.Service` convention.
- [ ] Keep the application-facing operation provider-neutral, for example `send(message, idempotencyKey)`.
- [ ] Define readonly message, address, provider-message-ID, tag, and delivery-result schemas.
- [ ] Define typed `EmailSendError`, `EmailRateLimitedError`, `EmailRejectedError`, and `EmailConfigurationError` failures.
- [ ] Add the `resend` dependency only to `@namera-ai/email`.
- [ ] Implement `ResendEmail.layer` with `Effect.tryPromise`, interruption handling where supported, and explicit provider-error mapping.
- [ ] Pass a stable Resend idempotency key for every send operation.
- [ ] Keep Resend's 24-hour idempotency window in mind; application persistence remains the durable source of delivery state.
- [ ] Implement a `FakeEmail.layer` that records messages for deterministic tests without network calls.
- [ ] Implement a local-development layer that safely previews or captures email instead of using production recipients.
- [ ] Add HTML and plain-text magic-link templates with an explicit typed input model.
- [ ] Keep template rendering pure and snapshot-test the important content, URL, code, and expiry text.
- [ ] Do not add open/click tracking parameters or third-party assets to authentication email templates.
- [ ] Implement Resend webhook signature verification against the raw request body.
- [ ] Decode supported Resend delivery, delayed, failed, bounced, and complained events into provider-neutral events.
- [ ] Deduplicate webhook processing using the provider webhook event ID.
- [ ] Unit-test Resend success, rejection, throttling, network failure, malformed response, and duplicate webhook cases.

### Database support

- [ ] Replace the generic verification value with purpose, token hash, code HMAC, attempts, expiry, consumed time, and safe return-path fields.
- [ ] Add an atomic `invalidatePendingAndInsert` repository operation for resend behavior.
- [ ] Add atomic `incrementAttempts` and conditional `consume` repository operations.
- [ ] Store only a digest of session credentials and add lookup by digest.
- [ ] Add session rotation, revocation, expiry, and cleanup repository operations.
- [ ] Add an `email_outbox` table with status, attempts, next-attempt time, lease, provider message ID, idempotency key, and timestamps.
- [ ] Encrypt any outbox payload containing a raw magic-link secret or code; never store those credentials as plaintext.
- [ ] Add email-outbox repository operations for enqueue, lease batch, mark sent, reschedule, and mark permanently failed.
- [ ] Add a webhook-event table or inbox record with a unique provider event ID for idempotent processing.
- [ ] Add migrations and indexes for verification lookup, verification cleanup, outbox claiming, and webhook deduplication.
- [ ] Add concurrency tests proving one verification consumer and one outbox worker can win each record.

### Application services

- [ ] Implement `MagicLinkService` in `packages/application` using class-based `Context.Service` and named `Effect.fn` operations.
- [ ] Make `MagicLinkService.request` depend on configuration, repositories, crypto, clock, rate limiting, and the outbox—not directly on Resend.
- [ ] In one transaction, invalidate prior credentials, insert the new verification, and enqueue the encrypted email payload.
- [ ] Make `MagicLinkService.verify` atomically consume the credential, find or create the user according to policy, and create a fresh session.
- [ ] Implement `SessionService` so API routes never coordinate session hashing, rotation, or revocation themselves.
- [ ] Implement `EmailDeliveryWorker` in `packages/application` using the outbox repository and provider-neutral `EmailService`.
- [ ] Poll or wake the worker with Effect scheduling, lease jobs transactionally, send with Resend idempotency, and apply bounded exponential retry with jitter.
- [ ] Model permanent Resend rejections separately from retryable transport and rate-limit failures.
- [ ] Decrypt sensitive email payloads only immediately before delivery and avoid attaching them to errors, logs, spans, or metrics.
- [ ] Implement `EmailWebhookService` to apply provider-neutral delivery events and suppression decisions.
- [ ] Export one `ApplicationLive` layer containing application services and one explicit background-program layer for workers.
- [ ] Provide repositories and adapters into application layers with `Layer.provide`; do not expose raw infrastructure through `Layer.provideMerge`.

### Effect workflow decision

- [ ] Use ordinary `Effect` operations for magic-link request and verification; they are short request-scoped transactions.
- [ ] Use a database outbox plus `EmailDeliveryWorker` for durable email retries and crash recovery.
- [ ] Do not make one workflow wait for the user to click the email; verification is a separate authenticated request correlated by the database record.
- [ ] Do not add `@effect/workflow` for the first magic-link implementation.
- [ ] Reassess `@effect/workflow` only when the product has genuinely long-running, multi-step processes that must suspend and resume across deploys, such as approval chains or timed onboarding sequences.
- [ ] If durable workflows are adopted later, keep their engine and persistence adapter in the server composition root while workflow definitions remain in `packages/application`.

### API package

- [ ] Make auth route handlers depend on `MagicLinkService` and `SessionService` rather than database repositories.
- [ ] Add the generic magic-link request endpoint.
- [ ] Add the non-consuming landing `GET` and consuming verification `POST` endpoints.
- [ ] Add the Resend webhook endpoint with access to the exact raw body required for signature verification.
- [ ] Map application errors to public protocol errors only at the HTTP boundary.
- [ ] Centralize session-cookie creation and clearing in one API helper.
- [ ] Set the host-only `__Host-namera-session` cookie only after successful application service completion.
- [ ] Centralize exact trusted-origin checks and credentialed CORS middleware.
- [ ] Add request IDs and propagate trace context before invoking route handlers.
- [ ] Keep route handlers thin: decode, call application service, map result, set cookie or response.

### Server composition root

- [ ] Create `apps/server/src/config.ts` as the only environment-variable decoding boundary.
- [ ] Create focused live layers for database, repositories, auth config, Resend config, email, rate limiting, encryption, telemetry, API, and workers.
- [ ] Compose infrastructure into `ApplicationLive`, then provide application services to `ApiLive`.
- [ ] Launch the HTTP server and email worker in the same Effect runtime and shared process while keeping them as separately testable layers.
- [ ] Ensure a failure in one supervised background worker is logged and restarted according to policy instead of silently terminating delivery.
- [ ] Use `NodeRuntime.runMain` or `Layer.launch` for lifecycle, signals, finalizers, and graceful shutdown.
- [ ] Keep `apps/server` free of business rules; it selects implementations and supplies runtime configuration only.
- [ ] Add a server composition test that constructs the complete layer graph with test adapters and catches missing dependencies.

Suggested shape:

```ts
const InfrastructureLive = Layer.mergeAll(
  DatabaseLive,
  AuthConfigLive,
  ResendConfigLive,
  RateLimiterLive,
  CryptoLive,
  TelemetryLive,
);

const ApplicationLive = Application.layer.pipe(Layer.provide(InfrastructureLive));

const ServerLive = Layer.mergeAll(
  Api.layer.pipe(Layer.provide(ApplicationLive)),
  EmailDeliveryWorker.layer.pipe(Layer.provide(ApplicationLive)),
);
```

The final implementation may need a shared intermediate layer for repositories
and adapters. Preserve dependency direction rather than forcing this exact snippet.

### OpenTelemetry, metrics, tracing, and logs

- [ ] Add `@effect/opentelemetry` to `apps/server`; keep exporter SDK dependencies out of application and email packages.
- [ ] Start with Effect's native OTLP tracer, metrics, and logger layers when exporting directly to an OpenTelemetry collector.
- [ ] Use the OpenTelemetry `NodeSdk` integration only if the server needs third-party OpenTelemetry SDK instrumentation that native Effect telemetry does not provide.
- [ ] Configure OTLP endpoints, resource attributes, service name, environment, sampling, batching, and shutdown flush in `apps/server`.
- [ ] Use `Effect.fn("Service.operation")` for application and adapter methods so operations receive consistent spans and stack traces.
- [ ] Add explicit child spans around transaction, outbox enqueue, Resend request, webhook processing, and worker-batch boundaries.
- [ ] Let database and HTTP instrumentation produce low-level spans; do not duplicate a span for every repository helper unless it adds useful semantics.
- [ ] Propagate trace context into outbox records so asynchronous email delivery can link to the requesting trace without storing sensitive values.
- [ ] Define Effect metrics close to the owning code and export them through the server telemetry layer.
- [ ] Add counters for magic-link requests, verification outcomes, resend attempts, email outcomes, webhook outcomes, and rate-limit decisions.
- [ ] Add histograms for request-to-verification time, Resend latency, worker batch duration, and delivery attempts.
- [ ] Add gauges for pending outbox jobs and oldest pending-job age.
- [ ] Keep metric attributes low-cardinality: outcome, method, provider, and error category only.
- [ ] Never use email, user ID, verification ID, token, request ID, or provider message ID as metric attributes.
- [ ] Use structured `Effect.log*` events with stable event names and safe fields such as outcome, attempt number, and error category.
- [ ] Annotate logs with request and trace context, but redact tokens, codes, cookies, authorization headers, recipient addresses, and full callback URLs.
- [ ] Log expected typed failures at the boundary that handles them; avoid logging the same failure in repository, application, and API layers.
- [ ] Preserve unexpected defects and causes for diagnostics while sanitizing provider responses that may contain recipient data.
- [ ] Add telemetry tests using in-memory or test exporters to verify span names, metric changes, error status, and credential redaction.

Recommended semantic names:

```text
Spans
  Auth.MagicLink.request
  Auth.MagicLink.verify
  Email.Outbox.enqueue
  Email.Outbox.deliver
  Email.Resend.send
  Email.Resend.webhook

Metrics
  auth.magic_link.requests
  auth.magic_link.verifications
  auth.magic_link.verification_duration
  email.send.attempts
  email.send.duration
  email.outbox.pending
  email.outbox.oldest_age
```

### Foundation tests and start gate

- [ ] Verify package-boundary and circular-dependency checks pass.
- [ ] Verify server configuration decoding fails before opening a network port when required values are invalid.
- [ ] Verify the fake email, test clock, deterministic crypto, test rate limiter, and in-memory telemetry layers compose with `ApplicationLive`.
- [ ] Verify an outbox record and business change commit or roll back together.
- [ ] Verify a worker crash after Resend accepts a message does not produce duplicates when retried with the same idempotency key.
- [ ] Verify application and email tests perform no network calls and read no process environment.
- [ ] Verify logs, spans, metrics, and test failure output contain no raw credentials or recipient addresses.
- [ ] Begin the magic-link feature checklist below after these package contracts, test layers, and server composition boundaries exist.

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
- [ ] Handle Resend webhook events, suppressions, provider failures, and resend behavior.
- [ ] Ensure provider payloads and events do not retain credentials unnecessarily.

### Security and privacy

- [ ] Redact callback query strings, tokens, codes, sessions, and sensitive PII from application logs, spans, metrics, and errors.
- [ ] Confirm public responses and timings do not disclose account existence.
- [ ] Verify email scanners cannot consume credentials with a `GET` request.
- [ ] Add protection against replay, brute force, redirect abuse, session fixation, and concurrent consumption.
- [ ] Require step-up authentication for high-risk account and authorization changes.
- [ ] Implement HMAC key versioning so credentials can be verified during a bounded rotation window.

### Testing

- [ ] Add unit tests for normalization, redirects, expiry, attempts, hashing, and public error mapping.
- [ ] Add database tests for resend invalidation, atomic consumption, concurrency, and rollback.
- [ ] Add API tests for non-consuming GET, POST verification, headers, cookies, and redirects.
- [ ] Add cross-device, two-tab, expired-page, disabled-user, and existing-session tests.
- [ ] Test outbox idempotency, retry behavior, bounce handling, and log redaction.
- [ ] Add request, delivery, verification, replay, expiration, and rate-limit metrics.
- [ ] Implement a supported resend or alternative recovery path for email-delivery failures.
