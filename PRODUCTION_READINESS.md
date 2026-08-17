# Namera production readiness

Reviewed against the repository state on 17 August 2026.

## Decision

The backend is feature-complete enough for a controlled single-replica staging
deployment and end-to-end product testing. It is not yet ready for a general
multi-replica production launch.

The primary transaction path is implemented and tested: users create EVM smart
accounts, define immutable session keys and policies, delegate those keys to API
keys, MCP clients, or CLI installations, then execute or sign through the
delegated actor. The remaining production work is mostly deployment safety,
distributed runtime behavior, external-provider verification, retention, and
unfinished dashboard surfaces.

The current migration chain assumes a disposable development database. The
latest OAuth migration intentionally drops the old `mcp_authorization` table
and creates `oauth_authorization`; it contains no backfill or compatibility
logic. Provision a clean database for the first deployment.

## Current implementation

| Area           | State                                      | Important boundary                                                                                        |
| -------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Authentication | Implemented                                | Magic-link request/verify, hashed credentials, cookie sessions, individual revocation                     |
| Organizations  | Implemented                                | Creation, switching, metadata, members, roles, invitations, one-owner application invariant               |
| Authorization  | Implemented                                | User, API-key, MCP, and CLI actors; member permissions, OAuth scopes, and session-key grants              |
| Wallets        | Implemented for EVM                        | Kernel and Safe smart accounts, local development keys, GCP KMS production keys                           |
| Session keys   | Implemented                                | Immutable keys, time-window and native-spend policies, state and concurrent reservations, revocation      |
| Execution      | Implemented                                | Prepare/simulate, evaluate/reserve, sign, submit, receipt wait, reconcile worker, settle/release, reads   |
| Signatures     | Implemented for EVM                        | Message and typed-data signing through signature policies                                                 |
| API keys       | Implemented                                | Create/list/get/revoke, bounded lifetime, grants, audit, notifications, rate limit                        |
| OAuth and MCP  | Implemented for Effect's 2025-06-18 target | PKCE, DCR, refresh rotation, consent, `/mcp`, 11 grant-scoped tools                                       |
| CLI            | Implemented                                | RFC 8628 login, OS keyring, profiles, refresh locking, wallet/session/execution/sign commands             |
| SDK            | Implemented                                | Typed API client with API key, fixed bearer, or refreshable bearer authentication                         |
| Billing        | Free plan only                             | Organization account/subscription, member/wallet/execution limits, read-only API                          |
| Notifications  | Backend implemented                        | Inbox rows, preferences, email linkage; dashboard inbox is absent                                         |
| Email          | Implemented                                | Encrypted transactional outbox, React Email templates, Resend, leases, retries, expiry                    |
| Audit          | Write path implemented                     | Typed user/organization events; no public audit read API or UI                                            |
| Telemetry      | Implemented                                | Effect traces/logs/metrics, browser OTLP proxy, LGTM development, Axiom production                        |
| Dashboard      | Partial                                    | Auth, consent, settings, members, API keys, wallets, session keys; several product pages are placeholders |

### Actor access model

- A user session authorizes management actions through organization membership
  and `MemberPermissions`.
- An API key authenticates with `x-api-key` and can reach only its active
  session-key grants.
- An MCP bearer token is bound to the exact `/mcp` resource, its MCP scopes, its
  OAuth authorization, and its active grants.
- A CLI bearer token is bound to the API origin, CLI capability scopes, its
  OAuth authorization, and its active grants.
- Execution and signing require one complete granted session key whose policy
  set accepts the operation. Grants do not bypass policies, and scopes do not
  create grants.

## Production blockers

Resolve these before a public launch.

### 1. Distributed rate limiting

The server uses Effect's in-memory rate-limit store. It is correct only for one
server process. Before running multiple Kubernetes replicas, provide a shared
Redis-backed store and verify atomic limits for magic links, invitations, API
key creation, OAuth/device polling, MCP, execution, RPC, and telemetry proxy
traffic. A single replica is acceptable for staging if this constraint is
explicit.

### 2. Trusted client addresses

Rate limits and audit transport context currently use the directly observed
remote address. Behind a GKE ingress or load balancer, add trusted proxy handling
for the exact deployed topology. Do not accept arbitrary forwarded headers from
the public internet. Verify that per-IP policies see the real client rather than
the ingress address before production traffic.

### 3. GCP KMS live verification

Production must use `WalletKeys.layer`, not the local file layer. In project
`prod-9427`, verify:

- the KMS API, key ring, location, service account, and IAM permissions;
- P-256 software/HSM and HSM secp256k1 creation/signing combinations actually
  used by plans;
- CRC32C integrity checks and public-key conversion against live responses;
- pod Workload Identity without a mounted long-lived service-account key;
- disable/destroy behavior and operator recovery procedures.

There is no compensation workflow yet for a provider key created successfully
before wallet persistence fails. Add reconciliation for unreferenced KMS keys or
an operator-visible repair queue before wallet volume is meaningful.

### 4. Production secrets and configuration

Store all secrets in the deployment secret manager and inject them at runtime:

- PostgreSQL credentials;
- independent base64url HMAC and encryption keys;
- Resend API key and sender identity;
- Alchemy and Pimlico API keys;
- Axiom API token and OTLP datasets;
- GCP project, location, and key-ring identifiers.

Set `NODE_ENV=production`, public API/dashboard origins, credentialed CORS, and
secure cookies to the final HTTPS origins. Never use
`WALLET_KEYS_LOCAL_DIRECTORY` as the production provider. Define a rotation
procedure before rotating the encryption key because encrypted email jobs do not
yet carry multiple encryption-key IDs.

### 5. External provider acceptance

Run live smoke tests for:

- Resend sender-domain authentication, magic-link and security-email delivery,
  reply-to behavior, and spam placement;
- Alchemy RPC resolution for every advertised supported chain;
- Pimlico sponsorship/bundler behavior, gas estimates, submit, receipt timeout,
  and reconciliation;
- Axiom ingestion for backend and browser traces, logs, and metrics.

Email delivery webhooks, bounce/suppression handling, and provider alerting are
not implemented. At minimum, monitor terminal email jobs and Resend suppression
state operationally at launch.

### 6. Retention and cleanup

Add scheduled cleanup or an explicit retention job for expired/revoked:

- verification records and browser sessions;
- invitations;
- OAuth authorization requests, authorization codes, device requests, and
  inactive token families;
- session keys and other terminal records once retention periods are defined.

Correctness does not depend on immediate deletion, but unbounded retention is an
operational and privacy problem.

### 7. Production delivery artifacts

This repository has development Compose services but no production Dockerfile,
Kubernetes manifests, or deployment pipeline. If infrastructure owns those
elsewhere, verify that the image:

- uses Node.js 24.14 or newer and the frozen pnpm lockfile;
- builds `@namera-ai/server` and starts `apps/server/dist/index.js`;
- runs as a non-root user with a read-only filesystem except required temporary
  paths;
- exposes port 8080 and uses `/health` for readiness/liveness;
- has graceful termination long enough for Effect scopes/workers to close;
- applies resource requests/limits and prevents two incompatible migration
  versions from starting concurrently.

The server applies migrations under a PostgreSQL advisory lock before opening
the HTTP port. For the first production deployment, point it at a new empty
database and verify the complete migration chain in a disposable environment
first.

### 8. Alerts and operational dashboards

Telemetry export exists, but production alert rules and dashboards do not.
Create alerts for HTTP 5xx/latency, authorization rejection changes, execution
failure/reconciliation age, email terminal failures, database saturation,
rate-limit rejections, KMS/Pimlico/Alchemy errors, worker liveness, and OTLP
export failures. Keep attributes bounded and never add credential or payload
data to logs.

## Important follow-up, not launch blockers for a small beta

### Backend and product

- Paid billing is not implemented. There is no Stripe dependency, checkout,
  subscription mutation, webhook workflow, usage-event delivery, billing audit,
  or paid-plan UI. The code-owned free plan is enforced and is suitable for the
  initial beta.
- Custom-role CRUD and explicit ownership transfer are deferred. System roles
  and one-owner hierarchy enforcement are implemented.
- Audit events are written but cannot yet be listed through a public API.
- Organization deletion, wallet archive/freeze, per-grant management, and
  external identity providers are intentionally unsupported.
- Only `eip155` execution/signing is implemented. Solana, Cosmos, additional
  policies, and namespace-specific adapters remain future product work.
- MCP targets the Effect-supported `2025-06-18` protocol. Client ID Metadata
  Document behavior and newer MCP revisions are deferred until the Effect
  adapter supports them.

### Dashboard

The following are implemented: magic-link authentication, invitation review,
profile/workspace/preferences/security settings, member and invitation
management, API-key management, wallet list/create, session-key list/create,
OAuth consent, and CLI consent.

The following remain placeholders or absent:

- overview, assets, activity, identity, MCP management, templates, and billing;
- notification inbox;
- wallet and session-key detail pages;
- execution history/detail and transaction composer;
- policy state/usage visualization;
- CLI authorization management and revocation;
- audit history.

The production build also reports several chunks above 500 kB, notably the icon
picker and main application chunks. This is not a correctness blocker, but route
and component code splitting should be measured before optimizing. There are no
browser interaction or accessibility regression tests yet.

### SDK and CLI delivery

- Choose versioning, changelog, provenance, npm publishing, and compatibility
  policy for `protocol`, `api`, `sdk`, and the CLI.
- Run packaged CLI tests against macOS Keychain, Windows Credential Manager, and
  Linux Secret Service.
- Test refresh contention with two real CLI processes and document installation,
  upgrade, logout, authorization revocation, and CI usage.
- Add convenience execution polling only after the current submission model has
  real consumer feedback.

## Verification evidence

The repository currently passes:

```text
pnpm check
  54/54 formatting, lint, typecheck, test-typecheck, and build tasks

pnpm test
  server:       25 files, 114 tests
  evm:           4 files,  11 tests
  wallet-keys:   1 file,    4 tests
  sdk:           1 file,    5 tests
  cli:           1 file,    3 tests
```

The server tests exercise migrated PGlite with real repositories, application
workflows, authorization middleware, and HTTP handlers. They cover auth,
organizations, invitations, members, billing limits, notifications, durable
email jobs, wallets, session keys, API keys, execution/reconciliation,
signatures, OAuth, MCP tools, RPC proxy, and telemetry proxy behavior.

Coverage gaps that still matter are live GCP/Alchemy/Pimlico/Resend/Axiom tests,
browser tests, packaged CLI/keyring tests, chaos/restart behavior, migration
testing against the exact production PostgreSQL setup, and load tests.

## Recommended deployment order

1. Provision a clean PostgreSQL database and validate all migrations from zero.
2. Configure Workload Identity and run live GCP KMS create/sign/disable smoke
   tests in the production project with disposable keys.
3. Configure final origins, secrets, Resend, provider API keys, and Axiom.
4. Build the immutable server image and deploy one staging replica.
5. Smoke test magic-link login, organization creation, invitation, software and
   HSM wallet creation, session-key creation, API-key execution/signing, MCP
   OAuth/tools, CLI device login/commands, email delivery, and reconciliation.
6. Verify Axiom traces/logs/metrics and create the launch alerts.
7. Add trusted proxy address handling for the actual ingress.
8. Keep one replica for the private beta, or add the shared rate-limit store
   before scaling horizontally.
9. Add retention jobs and provider-key compensation before moving beyond a
   controlled beta.
10. Introduce Stripe only when paid plans are intentionally enabled.

## Go-live gate

For a controlled private beta, the minimum gate is: clean migration rehearsal,
live GCP/provider/email/telemetry smoke tests, correct HTTPS origin/cookie/CORS
configuration, trusted ingress address handling, one-replica enforcement, alert
coverage, backups, and a rollback runbook.

For a public or multi-replica launch, also require the shared rate limiter,
retention jobs, KMS orphan reconciliation, provider failure runbooks, packaged
client release automation, and browser/load testing.
