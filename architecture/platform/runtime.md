# Server runtime

`apps/server` is the only live composition root. It binds the Node HTTP server,
loads configuration, selects providers, applies migrations, starts scoped
workers, and mounts the typed HTTP API and protocol routes.

## Startup

```mermaid
sequenceDiagram
  participant Process as Node process
  participant Config as Effect Config
  participant DB as PostgreSQL
  participant Roles as Role synchronizer
  participant Workers as Scoped workers
  participant HTTP as HTTP server

  Process->>Config: Decode runtime configuration and secrets
  Process->>DB: Open pool and acquire migration advisory lock
  DB-->>Process: Apply migrations
  Process->>Roles: Synchronize owner/admin/member definitions
  Process->>DB: Upgrade remaining Free v1 subscriptions to v2 under billing locks
  Process->>DB: Bootstrap configured platform owner if none exists
  Process->>Workers: Start email, execution, billing, and session-operation workers
  Process->>HTTP: Bind configured host and port
```

Effect scopes close the server, workers, provider clients, exporters, and
database resources during shutdown.

HTTP and all four workers await the shared `BillingStartupUpgrade` layer after
migrations. The temporary upgrade uses existing server database credentials,
fails startup on errors, and skips subscriptions already on v2. See
[billing rollout](../billing/README.md#rollout-and-historical-periods) for
transaction, over-limit preservation, restart and removal semantics.

Before HTTP binds, `ADMIN_BOOTSTRAP_OWNER_EMAIL` optionally grants the first
platform owner to an existing verified user through the application workflow.
This follows migrations and uses the transaction-scoped team lock across replicas.
Existing ownership is never overwritten. Missing/unverified users are warned and
skipped until the next startup; configuration/database failures stop startup.
See [admin authorization](../auth/admin.md) for rollout and audit details.

## Layer composition

The live graph includes PostgreSQL repositories and transactions, Node Crypto,
the encrypted EmailJobs service, the selected email provider, disabled
GcpService and LocalService layers, EVM clients, passkey and Google verification, ENS, application workflows, route handlers, and
telemetry. Provider selection is environment-owned:

- wallet keys: disabled in every server environment for the self-custodial beta;
- email: development logger in development, Resend otherwise;
- telemetry: local LGTM outside production, Axiom datasets in production.

## HTTP boundaries

- The generated Effect `HttpApi` serves typed application routes.
- OAuth protocol routes handle form media types and protocol-specific error
  responses directly where the generated JSON API is not appropriate.
- MCP transport runs over CLI stdio. OAuth consent,
  token issuance and authorization management remain on the API.
- `/rpc/eip155/:chainId` proxies validated EVM JSON-RPC to Alchemy.
- `/t/{traces,logs,metrics}/v1` proxies browser OTLP without exposing provider
  credentials.
- `/health` is the process readiness/liveness endpoint; `/reference` serves the
  Scalar contract reference.

CORS uses configured product origins, including the dashboard, admin portal,
and public website according to the route boundary. Cookies, actor
authentication, permission narrowing, DTO mapping, rate limiting, and transport
error mapping live in server adapters rather than application workflows.

The outer security middleware sets `nosniff`, frame denial, no-referrer, and
defaults responses to `Cache-Control: no-store` before authentication or routing.
Successful public OAuth discovery responses retain their explicit cache policy;
all error responses use no-store. Status, cookies, and redirect locations are
preserved. Dashboard document CSP and WebAuthn permissions belong to its origin.

## Workers

### Email delivery

Claims due jobs with leases, decrypts and decodes the typed payload, sends via
the provider, and conditionally marks sent, retryable, expired, or failed.

### Execution reconciliation

Claims prepared or submitted execution rows with leases, checks bundler status
and receipts with bounded concurrency, retries uncertain states, and calls the
application settlement/release transitions under the current worker lease.

Idle polling is intentionally untraced. A span starts after work is claimed.

### Billing maintenance

Checks due Alchemy sponsorship costs every ten seconds, with persisted
10-second exponential retries capped at five minutes. Anniversary periods,
other expired reservations and ledger projections are reconciled once per
minute through the same billing application service.

### Session-operation reconciliation

Every five seconds, reconciles persisted installation/removal operations through
the session-key application service. Recovery uses the same receipt transitions
as foreground requests. Unsigned owner approvals are not broadcast by workers.

## Rate limiting

The current Effect store is process-local; deployment must retain a single
replica for limits to apply consistently. Global IP and focused limits protect
magic links, invitations, API-key creation, OAuth/device flow, MCP, execution,
signatures, RPC, and telemetry proxy traffic. Actor- or authorization-scoped
limits supplement IP limits where appropriate.

Before transport limits, the client-address middleware trusts sanitized ingress
headers unconditionally. This requires ingress to overwrite
`X-Real-IP` and `X-Forwarded-For` and prevent direct origin access. It prefers a
valid `X-Real-IP`, otherwise uses the first address in a valid `X-Forwarded-For`
chain, without a CIDR allowlist. Invalid/missing headers fall back to the socket.
There are no environment switches, proxy CIDRs, or range checks. Canonicalized
IPs populate the request's remote address for limits and downstream request
metadata. Transport tests cover malformed/over-32-hop chains, IPv6 normalization,
sanitized-header precedence/fallback, absent socket addresses, and
separate rate-limit buckets behind one proxy for both supported headers.

## Deployment

`apps/server/Dockerfile` builds the server-only production image from the repository
root. The manual `deploy-server.yaml` workflow calls `build-and-push.yaml` with app
name `namera-server`, pushes to Artifact Registry, and dispatches the image tag to
`thenamespace/infra`, which owns Helm values and ArgoCD deployment. Server secrets
are supplied at runtime, not baked into the image.
