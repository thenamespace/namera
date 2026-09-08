# Server runtime

`apps/server` is the only live composition root. It binds the Node HTTP server,
loads configuration, selects providers, applies migrations, starts scoped
workers, and mounts typed HTTP and MCP transports.

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
  Process->>Workers: Start email and execution reconciliation workers
  Process->>HTTP: Bind configured host and port
```

Effect scopes close the server, workers, provider clients, exporters, and
database resources during shutdown.

## Layer composition

The live graph includes PostgreSQL repositories and transactions, Node Crypto,
the encrypted EmailJobs service, the selected email provider, selected
WalletKeys provider, EVM clients, application workflows, route handlers, and
telemetry. Provider selection is environment-owned:

- wallet keys: local files for development, Google Cloud KMS for production;
- email: development logger in development, Resend otherwise;
- telemetry: local LGTM outside production, Axiom datasets in production.

## HTTP boundaries

- The generated Effect `HttpApi` serves typed application routes.
- OAuth protocol routes handle form media types and protocol-specific error
  responses directly where the generated JSON API is not appropriate.
- MCP transport runs in the CLI loopback listener, not the API. OAuth consent,
  token issuance and authorization management remain on the API.
- `/rpc/eip155/:chainId` proxies validated EVM JSON-RPC to Alchemy.
- `/t/{traces,logs,metrics}/v1` proxies browser OTLP without exposing provider
  credentials.
- `/health` is the process readiness/liveness endpoint; `/reference` serves the
  Scalar contract reference.

Credentialed CORS allows one configured dashboard origin. Cookies, actor
authentication, permission narrowing, DTO mapping, rate limiting, and transport
error mapping live in server adapters rather than application workflows.

## Workers

### Email delivery

Claims due jobs with leases, decrypts and decodes the typed payload, sends via
the provider, and conditionally marks sent, retryable, expired, or failed.

### Execution reconciliation

Claims prepared or submitted execution rows with leases, checks bundler status
and receipts with bounded concurrency, retries uncertain states, and calls the
same application settlement/release path used by the synchronous request.

Idle polling is intentionally untraced. A span starts after work is claimed.

## Rate limiting

The current Effect store is process-local. Global IP and focused limits protect
magic links, invitations, API-key creation, OAuth/device flow, MCP, execution,
signatures, RPC, and telemetry proxy traffic. Actor- or authorization-scoped
limits supplement IP limits where appropriate.

## Pending

- Replace the process-local limiter with an atomic shared store before running
  multiple server replicas.
- Resolve client addresses only through the trusted headers of the deployed
  ingress; never trust arbitrary forwarded headers.
- Add production image/manifests or document the external deployment repository.
- Add worker-liveness and queue-age alerts.
