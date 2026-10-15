# Server runtime

`apps/server` composes the Effect HTTP API, application workflows, persistence,
providers and scoped workers in a Node.js 24 process. API contracts contain no
handlers; application workflows contain no HTTP runtime.

## Startup

1. Construct database, repositories, crypto and provider layers.
2. Apply Drizzle migrations under the migration lock and synchronize system roles.
3. Optionally bootstrap the configured verified platform owner.
4. Open the HTTP listener. Workers have their own migration gate before starting.

The live runtime enables 1Claw and passkey verification. GCP and filesystem signer
services are composed as disabled layers. Development selects development EVM and
email layers; production email uses Resend. Missing required live configuration
fails layer construction rather than enabling a fallback custody provider.

## Request boundary

Outer middleware applies security headers, trusted client-address resolution,
telemetry, rate limits, body limits and analytics context. Typed handlers enforce
actor kind, permissions/scopes, exact Origin where required, and operation-specific
limits before calling application workflows. Responses use safe DTO mapping.

Bodies are limited to 2 MiB, or 64 KiB for OAuth. Node bounds headers to 16 KiB,
header receipt to ten seconds, request receipt to thirty seconds, and keep-alive
to five seconds. These are transport limits, not provider-operation deadlines.
API responses default to `no-store`; successful public discovery has an explicit
short cache policy. Security headers include frame denial, `nosniff` and
`no-referrer`. They apply both to routed responses and early body/rate-limit
responses, which can bypass the router's pre-response hook.

Rate limits use a shared process-local memory store. The deployment must overwrite
`X-Real-IP` and `X-Forwarded-For` and block direct origin access: the server trusts
those headers for throttle identity. The limiter does not coordinate replicas.
RPC and telemetry proxies have dedicated policies and upstream timeouts.

## Background work

| Worker           | Responsibility                                                                  |
| ---------------- | ------------------------------------------------------------------------------- |
| Email            | Deliver encrypted outbox jobs with leases, expiry and bounded retries.          |
| Execution        | Submit accepted delegated envelopes and reconcile receipts.                     |
| Session key      | Reconcile owner-approved onchain installation/removal.                          |
| Wallet operation | Reconcile owner transactions with durable retry scheduling.                     |
| Billing          | Period rollover, reservation recovery, sponsorship costs and projection repair. |
| Analytics        | Deliver committed milestones from the outbox.                                   |

Workers stop with the Effect scope. Leases protect durable work from concurrent
claims; process-level loops invoke application-owned transitions. Pending chain
operations are not failed or rebroadcast simply because a receipt is late.

## Source

- [Layer composition](../../apps/server/src/layers/)
- [Middleware](../../apps/server/src/middlewares/)
- [Worker entry points](../../apps/server/src/workers/)
- [Deployment configuration](../../apps/server/.env.prod.example)
