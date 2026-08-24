# Production readiness

This document tracks the work required to deploy Namera to beta users. It is a
release checklist, not a replacement for the technical source of truth in
[`architecture/`](architecture/README.md). Update the owning architecture
document whenever a task changes a contract, database invariant, workflow,
authorization rule, provider boundary, or runtime lifecycle.

## Target release

The first supported production shape is:

- invite-only private beta;
- one server replica with HTTP and background workers in the same process;
- a clean PostgreSQL 17 database;
- EVM accounts backed by Alchemy Modular Account V2 and Google Cloud KMS;
- the eight explicitly registered launch networks only after live certification;
- the Free plan only;
- testnet-first usage, with tightly limited mainnet value until independent
  account recovery exists.

Public multi-replica production, paid billing, non-EVM namespaces, and
enterprise administration are outside this release.

## Status legend

- `[ ]` not completed or not verified in the target production environment;
- `[x]` implemented and verified in the repository;
- **Blocker** must be complete before any beta invitation is sent;
- **Mainnet blocker** may be deferred only when the beta is explicitly limited
  to testnets or low-value accounts with the limitation disclosed;
- **Scale blocker** may be deferred while the deployment remains one replica.

## Current verification baseline

Snapshot from 2026-08-24:

- [x] `pnpm check` passes all 58 formatting, linting, type-checking, test
      type-checking, and build tasks.
- [x] Production dashboard and Node server builds complete.
- [x] `pnpm audit --prod --audit-level high` reports no known vulnerabilities.
- [ ] `pnpm test` passes. The current run fails while applying
      `CREATE EXTENSION pg_trgm` to PGlite; 24 server suites fail during setup and
      118 route tests are skipped.
- [ ] Dashboard browser tests exist. There are currently no dashboard test or
      specification files.
- [ ] Repository CI exists. No checked-in CI workflow currently runs the
      required gates.

## 1. Release scope and product controls

Owner: product, backend, frontend, and operations.

- [ ] **Blocker:** Publish the exact beta scope: supported account type,
      supported networks, Free limits, sponsorship behavior, and known recovery
      limitations.
- [ ] **Blocker:** Decide whether beta users may hold meaningful mainnet value.
      If yes, complete the account-recovery section before launch.
- [ ] Mark every launch chain as `production`, `preview`, `testnet-only`, or
      disabled through a bounded, code-owned registry and operator control.
- [ ] Hide routes and navigation for unfinished product surfaces, including the
      current Identity and Templates placeholders.
- [ ] Provide a beta support channel, security contact, and incident escalation
      owner.
- [ ] Publish Terms, Privacy Policy, data-retention disclosure, and beta-risk
      language appropriate for a programmable wallet service.
- [ ] Define the process for removing a beta user or organization without
      requiring organization-deletion product support.

Exit criteria:

- A tester can understand what is supported, what value is safe to place in an
  account, and how to contact Namera during an incident.
- Unsupported capabilities are not advertised in the dashboard, SDK, CLI,
  documentation, or MCP descriptions.

## 2. Continuous integration and test infrastructure

Owner: engineering.

- [ ] **Blocker:** Fix the server integration test database so `pg_trgm` is
      available, or run extension-dependent integration tests against PostgreSQL
      17 instead of PGlite.
- [ ] **Blocker:** Require `pnpm check` and `pnpm test` to pass without skipped
      launch-critical suites.
- [ ] Add CI jobs for formatting, linting, source type checking, test type
      checking, unit/integration tests, and production builds.
- [ ] Add a PostgreSQL 17 CI service and migrate a clean database from zero.
- [ ] Add schema-drift detection between Drizzle definitions and migrations.
- [ ] Build the production Docker image in CI and start it for a `/health`
      smoke test.
- [ ] Run `pnpm audit --prod` or an equivalent dependency scanner in CI.
- [ ] Add secret scanning and prevent production credentials from entering
      commits, artifacts, logs, or frontend bundles.
- [ ] Add API-contract compatibility checks before publishing the SDK or CLI.
- [ ] Add opt-in live-provider suites for GCP KMS, Alchemy, Blockscout,
      Namespace ENS, Resend, and Axiom.
- [ ] Run concurrency-sensitive billing, invitation, idempotency, policy-state,
      and worker-lease tests against PostgreSQL rather than PGlite.

Exit criteria:

- A clean CI run proves the migration chain, server routes, clients, dashboard
  build, and Docker image from a fresh checkout.
- A failed or skipped required suite prevents deployment.

## 3. Deployment and runtime

Owner: operations and backend.

- [x] The root Dockerfile uses Node.js 24, runs as the non-root `node` user, and
      exposes port 8080.
- [ ] **Blocker:** Choose and document the production compute, ingress, database,
      DNS, certificate, and secret-manager resources.
- [ ] **Blocker:** Configure `NODE_ENV=production`, final HTTPS API/dashboard
      origins, exact credentialed CORS, and secure cookies.
- [ ] Run the container with a read-only filesystem and explicit writable paths.
- [ ] Configure CPU, memory, request-body, request-timeout, and connection limits.
- [ ] Configure a termination grace period long enough to stop HTTP acceptance,
      interrupt workers, and release/expire leases safely.
- [ ] Split liveness from readiness. Readiness must at least verify successful
      startup migration and database connectivity; the current health response only
      reports process availability.
- [ ] Decide whether migrations run at server startup or in a single release
      job. Preserve the advisory-lock guarantee in either design.
- [ ] **Scale blocker:** Replace the process-local rate limiter with an atomic
      shared store before starting more than one replica.
- [ ] **Scale blocker:** Extract client addresses only from headers trusted for
      the exact ingress topology; never trust arbitrary forwarded headers.
- [ ] **Scale blocker:** Stress-test worker claims and leases across multiple
      replicas before horizontal scaling.
- [ ] Document deployment, rollback, database rollback/forward-fix, and complete
      service shutdown procedures.

Exit criteria:

- A staging deployment starts from the production image, becomes ready only
  after its schema is usable, terminates cleanly, and does not require writable
  container state.

## 4. Secrets and configuration

Owner: operations and security.

- [ ] **Blocker:** Maintain one canonical inventory of every required production
      variable by decoding the actual Effect configuration graph.
- [ ] Add `NAMERA_ENS_API_KEY` to the server environment example and deployment
      secret inventory.
- [ ] Inject PostgreSQL, crypto, Resend, Alchemy, Blockscout, Namespace ENS,
      Axiom, and GCP configuration from the deployment secret manager.
- [ ] Generate independent high-entropy HMAC and encryption keys. Do not reuse a
      provider token or database password as either key.
- [ ] Use Workload Identity or an equivalent short-lived identity for GCP; do
      not ship `GOOGLE_APPLICATION_CREDENTIALS` files in the production image.
- [ ] Verify no provider token, encryption key, HMAC key, database credential,
      OAuth credential, or wallet-key material appears in browser assets or logs.
- [ ] Define encryption/HMAC key rotation before adding multiple key IDs.
- [ ] Document provider-key rotation, compromise response, and emergency
      revocation for API keys, OAuth clients, Resend, Alchemy, Blockscout, ENS,
      Axiom, and GCP.

Exit criteria:

- Production can be rebuilt from infrastructure configuration without manually
  copying secrets, and every secret has an owner and rotation procedure.

## 5. HTTP and application security

Owner: backend and security.

- [ ] **Blocker:** Complete an endpoint-by-endpoint authentication,
      authorization, permission, actor-type, organization-isolation, and grant
      matrix.
- [ ] Add boundary regression tests for every entry in that matrix.
- [ ] Add Content Security Policy, HSTS, `X-Content-Type-Options`,
      `Referrer-Policy`, `Permissions-Policy`, and explicit framing policy.
- [ ] Verify `Cache-Control: no-store` on authentication, OAuth, credential,
      signing, execution, and other sensitive responses.
- [ ] Verify cookie flags and cross-origin behavior through the real HTTPS
      ingress.
- [ ] Bound JSON, form, RPC, MCP, and telemetry proxy body sizes at the server or
      ingress boundary.
- [ ] Verify transport timeouts and cancellation for provider and database
      operations that can outlive the client request.
- [ ] Add unusual authentication, authorization-denial, and rate-limit alerts
      without using unbounded identities as metric attributes.
- [ ] Conduct a focused threat-model review covering credential theft, tenant
      crossover, replay, confused-deputy behavior, malicious calldata, signing
      misuse, provider compromise, and operator access.

Exit criteria:

- Every public route has a documented actor and authorization rule, bounded
  input, tested tenant isolation, and an appropriate cache/security-header
  policy.

## 6. Authentication, sessions, API keys, and OAuth

Owner: backend and frontend.

- [ ] Add cleanup/retention for terminal magic-link verification rows.
- [ ] Add double-consumption and final-attempt concurrency tests for magic links.
- [ ] Define maximum concurrent sessions and implement emergency account-wide
      logout.
- [ ] Define retention or anonymization for session IP address and user agent.
- [ ] Add an API-key leak-response and zero-downtime rotation runbook.
- [ ] Alert on repeated failed API-key authentication and dormant credentials.
- [ ] Complete OAuth conformance and malicious-client testing.
- [ ] Test redirect, state, PKCE, resource/audience substitution, concurrent code
      redemption, refresh-token replay, and client mismatch.
- [ ] Test simultaneous device-code claim, approval/denial, and final polling.
- [ ] Define dynamic client-registration trust/rate policy and client-disable
      procedures.
- [ ] Define authorization approval expiry and reauthorization behavior.
- [ ] Add retention cleanup for expired authorization requests, codes, device
      requests, access tokens, refresh tokens, and revoked authorizations.
- [ ] Run interoperability tests with Codex, Claude, and a generic MCP OAuth
      client.
- [ ] Verify the consent UIs never expose internal scopes as unexplained machine
      strings and clearly identify the client, wallet, account, and session key.

Exit criteria:

- Authentication and OAuth survive replay, races, revocation, expiration, and
  malicious callback inputs while preserving tenant boundaries.

## 7. Database, migrations, backup, and retention

Owner: backend and operations.

- [ ] **Blocker:** Rehearse the full migration chain on the exact production
      PostgreSQL version using a clean database.
- [ ] **Blocker:** Configure encrypted automated backups.
- [ ] **Blocker:** Perform and time a restore drill; record RPO and RTO.
- [ ] Review every foreign key, organization-scoped composite key, unique
      constraint, partial index, check constraint, and deletion action.
- [ ] Define expand/backfill/contract migration rules for post-beta changes.
- [ ] Define retention tiers for sessions, verifications, invitations, OAuth,
      executions, signatures, policy reservations, billing records, notifications,
      email jobs, and audit events.
- [ ] Add bounded cleanup jobs after each retention period is approved.
- [ ] Verify billing balance and policy-state compare-and-swap behavior under
      concurrent PostgreSQL transactions.
- [ ] Inspect query plans for the highest fan-out list, overview, execution,
      inbox, portfolio, and billing queries with beta-shaped data.
- [ ] Monitor pool usage, query latency, locks, deadlocks, disk growth, backup
      age, and migration failures.

Exit criteria:

- The database can be built, backed up, restored, migrated, monitored, and kept
  within a documented retention policy.

## 8. Wallet custody and account recovery

Owner: wallet/backend, security, and operations.

- [ ] **Mainnet blocker:** Define and implement an account recovery model that
      does not depend on the same GCP project and primary KMS key.
- [ ] Evaluate and select an independent recovery validator, multisig/secondary
      owner, or tested owner-rotation path for Alchemy Modular Account V2.
- [ ] Add protocol, persistence, EVM adapter, application, API, dashboard, audit,
      and tests for the selected recovery mechanism.
- [ ] Test recovery before and after account deployment on every supported chain.
- [ ] Test recovery when the primary KMS key is disabled or inaccessible.
- [ ] Use a separate production GCP project and key ring with least-privilege
      Workload Identity.
- [ ] Do not grant ordinary server runtime identity permission to destroy wallet
      keys. Separate lifecycle/cleanup authority if destruction is required.
- [ ] Run disposable GCP create, public-key read, sign, disable, and permission-
      denial integration tests.
- [ ] Add durable operator-visible reconciliation for KMS keys created before a
      failed wallet persistence transaction.
- [ ] Add runbooks for KMS outage, permission regression, key disablement,
      accidental destruction request, project suspension, and regional/provider
      outage.
- [ ] Decide whether the beta permits HSM-protected wallets, software-protected
      wallets, or both and certify every exposed combination.

Exit criteria:

- Loss of the normal application runtime or primary signing identity does not
  permanently strand a funded account, or the beta is explicitly constrained
  so that this risk is acceptable and disclosed.

## 9. EVM chains and provider certification

Owner: EVM/backend and operations.

- [ ] **Blocker:** Run and retain a capability report for all eight advertised
      launch networks.
- [ ] Test Modular Account V2 derivation, deployment, reconstruction, P-256
      signing, ERC-1271/ERC-6492 verification, simulation, BSO sponsorship,
      unsponsored submission, receipt normalization, and explorer linking.
- [ ] Verify EntryPoint 0.7, account factory, validator module, Rundler, and BSO
      compatibility for each exact chain ID.
- [ ] Validate `simulateCalls`, asset changes, transfers, access lists, bytecode
      reads, and malformed metadata handling per chain.
- [ ] Define behavior when asset tracing fails but ERC-4337 simulation succeeds.
- [ ] Add automatic provider health probes.
- [ ] Add a bounded per-chain disable/kill switch that does not require a code
      release during an incident.
- [ ] Document sponsorship exhaustion, provider rate/capacity assumptions,
      funding guidance for unsponsored calls, and fallback behavior.
- [ ] Define receipt finality and reorg expectations per chain.
- [ ] Add live idempotency tests around provider timeouts, ambiguous submission,
      delayed receipt, rejection, revert, and duplicate request.

Exit criteria:

- Every advertised network passes the same versioned capability suite and can be
  disabled quickly when a required provider capability degrades.

## 10. Policies and delegated authority

Owner: EVM/backend, protocol, frontend, SDK, CLI, and MCP.

- [x] Deterministic policy registry, applicability, cardinality, priority,
      state initialization, generic operation reservations, and stable denial code
      with policy ID are implemented.
- [x] Time window, chain allowlist, native spend limit, gas budget, and signature
      type policies are implemented with dashboard editors/displays.
- [ ] **Mainnet blocker:** Add contract/address allowlist policy.
- [ ] **Mainnet blocker:** Add function-selector allowlist policy.
- [ ] **Mainnet blocker:** Add ERC-20/token spend limits based on stable
      simulation semantics.
- [ ] Restrict EIP-712 domain, verifying contract, and primary type before broad
      typed-data signing is enabled.
- [ ] Add comprehensive handler law tests for deterministic decisions, reserve
      atomicity, settlement bounds, and release inversion.
- [ ] Stress-test deterministic lock ordering and reservation behavior under
      concurrent executions.
- [ ] Add malformed or unavailable simulation-context tests for every policy
      that consumes simulation output.
- [ ] Publish human-readable documentation and client examples for every stable
      denial code.
- [ ] Confirm UTC hour/day/week/month boundary behavior and dashboard
      presentation.

Exit criteria:

- A session key can be constrained by destination, action, token/native value,
  gas, chain, time, and signing intent, or mainnet use is explicitly limited
  until those controls exist.

## 11. Background workers and recovery

Owner: backend and operations.

Implemented workers:

- [x] Email worker claims leased jobs, sends, retries, expires, and records
      terminal outcomes.
- [x] Execution worker claims prepared/submitted operations, observes provider
      status/receipts, and settles or releases durable state.
- [x] Billing worker rolls anniversary periods, recovers expired usage
      reservations, and repairs ledger-derived projections.

Required work:

- [ ] **Blocker:** Implement stale signature-operation recovery. Claim expired
      `reserved` signature operations, mark them failed with a stable interruption
      code, and release their billing/policy reservations.
- [ ] Add a repository query and expiry/status index appropriate for claiming
      stale signature operations concurrently.
- [ ] Test a crash after signature reservation and before provider signing,
      after provider signing and before settlement, and during lifecycle settlement.
- [ ] Define maximum execution reconciliation age and transition permanently
      unknown submissions to an operator-visible state.
- [ ] Add authorized operator retry, settle, release, and manual-resolution tools
      for stuck executions without permitting double settlement.
- [ ] Add KMS orphan repair/reconciliation with durable state and idempotent
      cleanup.
- [ ] Add email dead-letter inspection and replay with explicit authorization and
      audit.
- [ ] Add retention cleanup for expired auth, OAuth, notification, email,
      execution, signature, reservation, and audit records.
- [ ] Add oldest-item, lease-recovery, retry-age, terminal-failure, throughput,
      and worker-liveness metrics/alerts for every worker.
- [ ] Test graceful shutdown while each worker owns a lease.
- [ ] Test worker ownership and exactly-once state transitions across two
      processes before multi-replica production.
- [ ] Decide when workers move into a separate deployable process. Keep the
      single-process model for the private beta unless resource contention appears.
- [ ] Add Blockscout metadata refresh only if request-time stale refresh becomes
      insufficient; it is not a beta correctness requirement.
- [ ] Keep Stripe delivery/webhook workers disabled until paid plans are enabled.

Exit criteria:

- Every durable `reserved`, `prepared`, `submitted`, or leased state either
  completes, becomes safely retryable, or reaches an operator-visible terminal
  state after a bounded time.

## 12. Billing and quotas

Owner: billing/backend, EVM, operations, and frontend.

- [x] Free plan registry and organization-time anniversary periods exist.
- [x] Normalized meters, ledger events, balances, reservations, recovery, and
      projection reconciliation exist.
- [x] Wallet, execution, signature, and sponsored-gas operations integrate with
      billing.
- [x] Authenticated billing API and Free-plan dashboard exist.
- [ ] **Blocker:** Re-run all billing integration tests after fixing the database
      test environment.
- [ ] Add PostgreSQL concurrency tests proving hard limits cannot be crossed by
      simultaneous operations.
- [ ] Confirm Alchemy production execution/sponsorship cost assumptions against
      actual invoices and observed quote/receipt variance.
- [ ] Define user-visible behavior for hard-limit denial, reserved usage,
      sponsorship exhaustion, pricing outage, and anniversary rollover.
- [ ] Alert on stale reservations, recovery failure, projection repair, hard-
      limit denial spikes, and quote outages.
- [ ] Verify dashboard units, rounding, dates, settled amounts, and reserved
      amounts against the API.
- [ ] Keep Stripe customer, Checkout, portal, prices, webhooks, proration,
      delinquency, invoices, and paid overages deferred until paid plans launch.

Exit criteria:

- Concurrent requests cannot exceed Free limits, interrupted requests recover
  capacity, and operators can detect every reconciliation failure.

## 13. Notifications, inbox, and email

Owner: backend, frontend, and operations.

- [x] Durable inbox notifications, filters, read/archive mutations, rich detail
      rendering, notification preferences, encrypted email jobs, and email delivery
      worker are implemented.
- [ ] Update stale architecture sections that still list the inbox as pending.
- [ ] Verify Resend sender domain, DKIM, SPF, DMARC, reply-to, and delivery/spam
      placement.
- [ ] Verify preference resolution at global and organization scope in the
      production-shaped integration suite.
- [ ] Add provider bounce/suppression handling or an explicit manual monitoring
      process for the private beta.
- [ ] Define sent/failed/expired email-job retention and encrypted-payload
      clearing.
- [ ] Add dead-letter inspection, replay, audit, and alerts.
- [ ] Verify notification links, permission changes, expired resources, empty
      states, pagination, and multi-tab updates in browser tests.

Exit criteria:

- Security and lifecycle notifications remain durable even when email delivery
  fails, and terminal delivery failures are visible to operators.

## 14. Dashboard reliability and accessibility

Owner: frontend.

- [ ] **Blocker:** Add global TanStack Router error and not-found components.
- [ ] Replace indefinite loading states with explicit retryable error, not-found,
      permission-denied, offline, and provider-unavailable states.
- [ ] Audit every route so its page shell remains visible while only the
      data-dependent region loads.
- [ ] Add browser journeys for login/logout, workspace creation/switching,
      invitations, account creation and ENS, session-key policies, API keys, MCP,
      CLI device approval, execution, signatures, billing, assets, and inbox.
- [ ] Add keyboard and accessibility regression coverage for nested filters,
      tables, popovers, dialogs, tooltips, copy actions, and policy editors.
- [ ] Test owner/admin/member permissions and permission changes while a route is
      open. Backend authorization remains authoritative.
- [ ] Add operational UX for disabled chains, provider outages, sponsorship
      exhaustion, account funding, submitted/reconciling executions, policy denials,
      and temporary KMS unavailability.
- [ ] Test long account/ENS/session-key names, addresses, empty tables, one-row
      tables, pagination, large result sets, and clipboard failure.
- [ ] Test responsive layouts at supported mobile and laptop widths.
- [ ] Verify reduced motion, visible focus, accessible icon-button names, live
      asynchronous announcements, and contrast.
- [ ] Smoke-test the production browser bundle. Investigate externalized Node
      `ws` modules and ensure server-only WebSocket code is not used at runtime.
- [ ] Measure route chunks and lazy-load heavy optional UI such as the icon
      picker; do not optimize solely from bundle warnings without measuring user
      impact.
- [ ] Verify browser OTLP failure never blocks or visibly breaks product routes
      and never exposes Axiom credentials.

Exit criteria:

- Critical user journeys pass in the production build with keyboard-only use,
  explicit error recovery, correct permissions, and no blank application shell.

## 15. SDK, CLI, MCP, and public API

Owner: platform/backend and client maintainers.

- [ ] **Blocker when distributed:** Replace the SDK's localhost default with the
      production API origin or require an explicit base URL in unpublished builds.
- [ ] **Blocker when distributed:** Replace CLI localhost defaults, including
      login, with production-safe host selection while preserving `--host` and
      `NAMERA_API_URL` for development.
- [ ] Define semantic versioning, compatibility, deprecation, release notes, and
      support policy for protocol, API, SDK, CLI, and MCP changes.
- [ ] Add reproducible npm publication with provenance and package-content
      checks.
- [ ] Generate and publish the stable API/OpenAPI reference artifact.
- [ ] Test the packaged CLI on macOS, Windows, and Linux.
- [ ] Test macOS Keychain, Windows Credential Manager, Linux Secret Service, and
      two-process refresh-token contention against a live server.
- [ ] Add golden tests for pretty, JSON, NDJSON, and quiet output.
- [ ] Add MCP schema/description evaluations that distinguish wallet IDs,
      session-key IDs, execution IDs, addresses, chain IDs, values, and calldata.
- [ ] Verify every MCP failure exposes a stable actionable code without raw
      provider exceptions or sensitive details.
- [ ] Run end-to-end SDK, CLI, and MCP idempotency/retry tests against ambiguous
      transport and provider failures.

Exit criteria:

- A beta user can install a versioned client, target the production API without
  hidden development defaults, authenticate securely, and receive stable typed
  results and errors.

## 16. Telemetry, alerts, and operational dashboards

Owner: operations and backend.

- [ ] **Blocker:** Verify production traces, logs, and metrics arrive in Axiom
      with trace correlation and without secrets or unbounded attributes.
- [ ] Create dashboards and alerts for HTTP 5xx, latency, traffic, rate-limit
      rejection, and authorization anomalies.
- [ ] Alert on GCP KMS, Alchemy RPC/Rundler/BSO, Blockscout, ENS, Resend, database,
      and OTLP failures.
- [ ] Alert on execution reconciliation age, unknown terminal state, signature
      recovery, billing reservation age, billing repair, and email dead letters.
- [ ] Monitor database pool saturation, slow queries, locks, deadlocks, disk,
      backup age, and migration errors.
- [ ] Monitor worker liveness, oldest queued item, throughput, retries, lease
      recovery, and terminal outcomes.
- [ ] Define alert thresholds, on-call destinations, owners, severity, and
      runbook links. An emitted metric without an alert owner is not complete.
- [ ] Verify browser telemetry proxy rate limits, timeouts, CORS, and failure
      behavior through the production ingress.
- [ ] Define telemetry retention and access control.

Exit criteria:

- A provider, database, worker, authentication, billing, or execution failure is
  detected before a beta user has to report it, and the alert links to a usable
  response procedure.

## 17. Audit, privacy, and incident response

Owner: security, backend, operations, and product.

- [ ] Review every successful state mutation for transactional audit coverage
      and document intentional omissions.
- [ ] Define audit retention, access control, export requirements, and operator
      access logging.
- [ ] Decide retention/redaction for signed messages and EIP-712 typed data,
      especially when they contain personal or confidential information.
- [ ] Define retention/anonymization for IP addresses, user agents, provider
      error details, and notification payloads.
- [ ] Write runbooks for account/key loss, leaked API key, compromised OAuth
      client, global logout, provider outage, stuck execution, billing corruption,
      database restore, and telemetry outage.
- [ ] Define incident severity, notification owners, evidence preservation, and
      beta-user communication procedure.
- [ ] Add privileged audit search/export only when operational need justifies the
      surface; the dashboard audit-history UI is not required for private beta.

Exit criteria:

- Sensitive operational data has a documented purpose and lifetime, and every
  launch-critical incident has an owner and response procedure.

## 18. Staging release rehearsal

Owner: engineering, operations, and product.

Run this rehearsal from an empty production-shaped environment:

- [ ] Build and deploy the immutable server and dashboard artifacts produced by
      CI.
- [ ] Apply every migration from zero and synchronize system roles/data.
- [ ] Verify Workload Identity and disposable GCP KMS operations.
- [ ] Verify HTTPS, CORS, cookies, security headers, rate limits, and readiness.
- [ ] Create a user and organization through magic-link authentication.
- [ ] Invite, accept, reject, cancel, role-change, and remove test members.
- [ ] Create an ENS-labelled account and verify address reconstruction.
- [ ] Create session keys covering every policy type and representative denial.
- [ ] Create/revoke API keys, MCP authorizations, and CLI authorizations.
- [ ] Simulate and execute sponsored and unsponsored transactions on every
      enabled testnet.
- [ ] Exercise at least one tightly controlled mainnet execution if mainnet will
      be enabled.
- [ ] Sign and verify message and allowed typed-data operations.
- [ ] Observe submitted execution reconciliation and forced failure recovery.
- [ ] Force stale billing and signature reservations and verify recovery.
- [ ] Trigger inbox notifications, email retries, dead letters, and preferences.
- [ ] Verify billing limits, reservation display, anniversary date, and rollover.
- [ ] Verify portfolio partial-network behavior and metadata caching.
- [ ] Exercise SDK, installed CLI, and MCP against the production URL.
- [ ] Confirm traces, logs, metrics, alerts, backups, restore, rollback, and all
      relevant runbooks.
- [ ] Record results, failures, owners, and explicit sign-off from engineering,
      security/operations, and product.

## 19. Beta launch gate

Do not invite beta users until all of the following are true:

- [ ] Every **Blocker** in this document is complete.
- [ ] Every enabled mainnet capability has satisfied its **Mainnet blocker**, or
      the beta is constrained and disclosed accordingly.
- [ ] `pnpm check`, `pnpm test`, clean PostgreSQL migration, Docker smoke test,
      and dashboard critical journeys pass in CI.
- [ ] Backups and one restore drill are complete.
- [ ] GCP KMS, Alchemy, Blockscout, ENS, Resend, and Axiom production smoke tests
      pass.
- [ ] Chain kill switches and operator access are verified.
- [ ] Worker recovery and alerts cover executions, signatures, billing, and
      email.
- [ ] The staging rehearsal is signed off with no unresolved launch-critical
      findings.
- [ ] Rollback, incident, support, and user-communication owners are assigned.

## Deferred until after private beta

The following are intentionally not beta blockers unless product scope changes:

- shared rate limiting and multi-replica deployment;
- Stripe Checkout, portal, webhooks, paid plans, overages, trials, proration, and
  delinquency;
- custom role CRUD and enterprise network controls;
- ownership transfer and full organization deletion;
- audit-history dashboard and customer audit export;
- wallet archive/freeze product workflows;
- non-EVM namespaces;
- additional EVM account products exposed to users;
- NFTs and historical portfolio analytics;
- high-level MCP transaction helpers;
- proactive Blockscout metadata refresh;
- enterprise tamper-evident audit storage.

Reclassify a deferred item into the applicable section before expanding beta
scope to depend on it.
