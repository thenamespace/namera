# Production readiness

The current backend supports controlled single-replica staging and private-beta
testing. Public multi-replica production requires the gates below. The initial
deployment must use a clean database because the pre-production migration chain
does not preserve removed experimental schemas.

## Required gates

### Distributed runtime

- Replace the in-memory rate-limit store before horizontal scaling.
- Configure trusted client-address extraction for the exact ingress topology.
- Verify worker leases and graceful shutdown under pod termination.

### Wallet keys and chain providers

- Run live Google Cloud KMS create/sign/disable tests with Workload Identity for
  every production algorithm/protection combination.
- Add reconciliation or an operator repair queue for KMS keys created before a
  failed wallet persistence transaction.
- Smoke test every advertised Alchemy chain and Rundler/Gas Manager prepare/submit/receipt/
  reconciliation path.

### Secrets and external services

- Inject PostgreSQL, independent HMAC/encryption keys, Resend, Alchemy,
  Axiom, and GCP configuration from the deployment secret manager.
- Set final HTTPS API/dashboard origins, credentialed CORS, secure cookies, and
  `NODE_ENV=production`.
- Verify Resend domain authentication and delivery, Axiom ingestion, and
  provider failure alerting.

### Data operations

- Rehearse migrations from zero against production PostgreSQL.
- Define backups, restore testing, rollback, and incident runbooks.
- Add retention for expired/revoked verification, session, invitation, OAuth,
  and terminal operational data.
- Define encryption-key rotation before introducing multiple key IDs.

### Delivery and verification

- Build an immutable Node 24 image as non-root, with a read-only filesystem
  except explicit writable paths, port 8080, `/health`, resource limits, and a
  sufficient termination grace period.
- Add alerts for HTTP 5xx/latency, authorization anomalies, execution failure
  and reconciliation age, terminal email jobs, KMS/RPC/bundler errors, database
  saturation, worker liveness, and telemetry export.
- Add browser accessibility tests, load tests, packaged CLI/keyring tests, and
  live-provider smoke tests.

## Deferred product scope

Paid billing, custom-role CRUD, ownership transfer, organization deletion,
wallet archive/freeze, per-grant management, external identity providers, audit
read UI, and non-EVM namespaces are not required for a small free private beta.
Each owning feature document records its exact pending boundary.

## Deployment order

1. Validate all migrations on a clean production-shaped database.
2. Verify Workload Identity and disposable GCP KMS operations.
3. Configure final origins, secrets, providers, and telemetry.
4. Deploy one staging replica and exercise auth, organizations, invitations,
   wallets, session keys, API-key/MCP/CLI delegation, execution, signing,
   notifications, email, and reconciliation.
5. Verify traces, logs, metrics, alerts, backups, and rollback.
6. Add trusted ingress addressing and retain one replica for private beta.
7. Add the shared limiter and remaining operational gates before scaling.

## Pending

Every item in **Required gates** remains a production deployment responsibility
until verified in the target environment.
