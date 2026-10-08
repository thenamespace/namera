# Deployment and operational constraints

## Build and rollout ownership

The manual `deploy-server.yaml`, `deploy-dashboard.yaml`, `deploy-web.yaml`, and
`deploy-admin-portal.yaml` workflows call `.github/workflows/build-and-push.yaml`.
The shared job builds the selected Dockerfile from the repository root, pushes
an image to Artifact Registry, and dispatches its tag to `thenamespace/infra`.
That repository owns Helm values and ArgoCD rollout. Server secrets are injected
at runtime; frontend build configuration is public and must contain no secrets.

Deployments are serialized per application/environment without cancelling a
running deployment. The shared job references the selected GitHub environment,
so configured approvals cover image publication and the infra dispatch together.
Production dispatch must originate from `main`; the only accepted source inputs
are empty, `main`, and `refs/heads/main`. Checkout uses the dispatch commit SHA.
Staging accepts a selected ref. The workflow does not automatically require a
successful CI run for that commit. Rollbacks use approved existing images through
infra rather than arbitrary production source refs.

Actions are pinned to commit SHAs, checkout does not persist credentials, and
callers pass only the named infra dispatch token. Google authentication uses
Workload Identity Federation. Environment restrictions, required reviewers, IAM,
registry access, secret values and the external rollout cannot be established
from this repository alone.

## Runtime contract

The server runs on Node 24, migrates PostgreSQL before binding HTTP, and owns
scoped email, execution, billing and session-operation workers. `/health` is the
HTTP health endpoint. Shutdown disposes workers, clients, exporters and database
resources. See [runtime](runtime.md) for layer and worker ordering.

The rate limiter is process-local. A single replica is required for consistent
limits. Ingress must overwrite `X-Real-IP` and `X-Forwarded-For` and prevent direct
origin access because the server trusts sanitized ingress headers without a
proxy-CIDR allowlist. TLS, final origins, secure cookies and static document
security headers must match the deployed hosts.

Public wallets are passkey-owned and session signing happens on clients.
`WalletKeys.disabledLayer` is installed in every server environment; local/GCP
provider implementations are package capabilities, not active custody services.
Alchemy RPC, Rundler, BSO and Portfolio APIs serve the supported EVM networks.
The registry's `operationsEnabled` flag pauses new chain operations while signed
submissions and receipt recovery retain their lifecycle.

## Current service limits

- Billing runs the Free plan, internal metering and Alchemy BSO cost recovery.
  Payment checkout, payment webhooks and provider usage delivery are inactive.
- Email jobs track provider acceptance. Bounce/complaint webhooks and inbox
  delivery confirmation are not implemented.
- Authentication and operational history have no general scheduled retention
  service. Database backup, restore and retention policies belong to deployment
  operations; source migrations alone do not establish them.
- Durable recovery uses persisted operation state and leases. Originating trace
  context is not persisted across every queue boundary; recovery spans must not
  be interpreted as a continuous request trace.
- Host-level monitoring, export failures, alerts and live-provider compatibility
  require verification in the target environment. Local tests do not certify a
  hosted rollout or every supported authenticator/keyring platform.

The database catalog records active tables, including intentionally inactive
payment integration records. Migration history remains executable history and
must not be deleted merely because a table or route has been removed.
