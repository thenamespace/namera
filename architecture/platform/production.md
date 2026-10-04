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

- Verify passkey account creation, encrypted key export/import, local signing,
  owner-approved session installation and onchain revocation. The self-custodial
  runtime uses no server-side wallet-key provider or GCP KMS configuration.
- Smoke test every advertised Alchemy chain and Rundler/BSO prepare/submit/receipt/
  reconciliation path.

### Secrets and external services

- Inject PostgreSQL, independent HMAC/encryption keys, Resend, Alchemy,
  and Axiom configuration from the deployment secret manager.
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
  and reconciliation age, terminal email jobs, RPC/bundler errors, database
  saturation, worker liveness, and telemetry export.
- Add browser accessibility tests, load tests, packaged CLI/keyring tests, and
  live-provider smoke tests.

## Deferred product scope

Paid billing, custom-role CRUD, ownership transfer, organization deletion,
wallet archive/freeze, per-grant management, external identity providers, audit
read UI, and non-EVM namespaces are not required for a small free private beta.
Each owning feature document records its exact pending boundary.

## Deployment order

### GitHub deployment gates

The four manual deployment workflows use the shared `build-and-push.yaml` job.
It references the selected GitHub environment (`prod` or `staging`), which is
separate from runtime environment variables supplied by Google Secret Manager.
Image publication and the infra-repository dispatch run in the same job so an
environment approval, when configured, covers both without a second prompt.
Deployments are serialized per app/environment; running deployments are not
cancelled by newer requests.

Production requires a dispatch from `main` and accepts only an empty, `main`, or
`refs/heads/main` checkout input. Checkout uses the workflow's exact commit SHA,
not the potentially newer branch tip. Staging accepts a selected ref. The GitHub
`prod` environment must independently allow only the `main` branch; `staging`
can allow other refs. Rollbacks use previously approved images through the infra
repository, not arbitrary production source refs. Run CI for the exact deployment
commit before dispatching; this workflow does not automatically gate on CI.

Repository environment settings are configured outside Git. `prod` currently
has a main-only branch policy. Required reviewers were unavailable on the current
private-repository plan; configure them when supported if an approval checkpoint
is desired. Staging currently has no branch restrictions.

Deployment Actions are pinned to commit SHAs. Callers pass only the named infra
dispatch token, and checkout does not persist its Git credential. Review and
update pinned Actions deliberately.

Before using the environment-bound workflow, infra must verify Google Workload
Identity mappings, provider conditions, and registry IAM. The default GitHub OIDC
subject now identifies `repo:thenamespace/namera-core:environment:prod` (or
`:staging`) rather than a branch subject; custom subject templates may differ.
Restrict trust to the exact repository and intended environment/workflow/ref.
Scope the build identity to required registry access and the dispatch token to
the required infra-repository operation; runtime secrets stay in Secret Manager.
Cloud trust and token scope were not verified locally because `gcloud` had no
active account. Do not assume a successful configuration edit proves deployment
authentication or rollout works.

### Runtime rollout

1. Validate all migrations on a clean production-shaped database.
2. Verify passkey and local session-key lifecycle on the target clients.
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
