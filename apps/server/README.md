# @namera-ai/server

The Node.js composition root for the Namera API. It owns the HTTP runtime,
transport middleware, API handler implementations, authorization, and assembly
of live infrastructure and application layers.

The server exposes the `@namera-ai/api` contract through Scalar at `/reference`
and delegates authenticated workflows to `@namera-ai/application` services.

See [Server runtime](../../architecture/platform/runtime.md) for startup, Layer
composition, transport, worker, and deployment boundaries, and
[backend workspace architecture](../../architecture/packages/backend.md) for
the server/application ownership split.

## Structure

- `src/config.ts` — server host, port, and browser origin configuration.
- `src/routes/core/` — API assembly, root, health, and Scalar reference routes.
- `src/routes/auth/` — user authentication, organizations, API keys,
  notifications, and OAuth routes. OAuth protocol registration,
  authorization, token/device/revocation, metadata, and shared response parsing
  are separate modules composed by one route layer.
- `src/routes/wallet/` — wallet and session-key handlers.
- `src/routes/execution/` — execution and signature handlers.
- `src/routes/ens.ts` — public, IP-rate-limited ENS label availability.
- `src/routes/billing/` and `src/routes/proxy/` — focused
  billing, RPC, and telemetry transport boundaries.
- `src/helpers/` — actor enforcement, cookie helpers, and domain-separated DTO
  mappers composed through one stable helper barrel.
- `src/middlewares/` — authorization, CORS, and rate-limit middleware.
- `src/rate-limit.ts` — code-owned route policies and keyed limit helpers.
- `src/layers/` — runtime and dependency composition.
- `src/workers/` — scoped background loops that invoke application-owned durable work.
- `src/index.ts` — Node process entry point.

Before binding the HTTP port, the server applies pending database migrations
and synchronizes the canonical system roles through
`@namera-ai/database/DatabaseMigration`. The temporary `BillingStartupUpgrade`
then upgrades current Free v1 subscriptions to v2, preserving usage and reset
dates. HTTP and every worker wait for completion; errors fail startup and the
next run safely resumes. No extra environment variables are required. See
[billing rollout](../../architecture/billing/README.md#rollout-and-historical-periods)
before removing the hook after all environments have migrated.
It then optionally bootstraps the first
platform owner from `ADMIN_BOOTSTRAP_OWNER_EMAIL` before accepting traffic.

After migrations and the billing upgrade complete, the server starts scoped email, execution, and
billing workers. They use locked/leased claims safe for multiple instances and
stop with the server scope. The execution worker claims bounded batches, checks receipts concurrently,
and settles, releases, or reschedules submissions left pending by HTTP requests.
The billing worker advances anniversary periods, recovers expired usage holds,
and repairs balance projections from the immutable ledger. It also reconciles
Alchemy BSO gas holds separately from onchain confirmation using the server-only
`ALCHEMY_ACCESS_TOKEN`. Missing provider costs retain the hold and retry;
execution confirmation and session activation do not wait for billing.
HTTP requests only enqueue email work and never wait for background delivery.

Execution submission status is readable only by the machine actor that created
it. Confirmed execution detail and history use one route for users, API keys,
CLI, and MCP actors: users require `execution:read` and see the active organization,
while machine actors see executions performed by their currently granted active
session keys, including executions submitted by other actors. CLI `execution:read`
and MCP `mcp:read` scopes remain required. History rows include
safe account presentation data, a session-key summary, and the initiating actor
type and ID so dashboard and delegated clients do not need secondary lookups.

`POST /executions/simulate` is available to API-key and CLI actors that may
execute. It applies a dedicated actor rate limit, runs the same unsigned EVM call
simulation and current policy evaluation for the explicitly selected installed
session key used before execution, and returns
call success independently from session-key policy eligibility. It does not
reserve policy state, sign or submit calls, create records, or consume billing
usage.

`POST /executions/prepare` accepts an explicit installed session key and an
optional `sponsor` boolean that defaults to
`true`. Sponsored requests use Alchemy Bundler Sponsored Operations (BSO);
setting it to `false` submits the estimated UserOperation through regular
Rundler without the BSO policy header. Confirmed sponsored and unsponsored
requests both consume the appropriate execution meter; only sponsored mainnet
requests reserve and settle the sponsored-gas meter. `POST /executions/complete`
accepts only a submission ID and local secp256k1 signature, verifies the stored
operation and current authority, and queues its signed envelope for the worker.
Status polling distinguishes unsigned `reserved`, signed `prepared`, and
bundler-observed `submitted` attempts. The synchronous `POST /executions` endpoint has been removed; SDK/CLI
consumers use the detached flow.

`POST /signatures/prepare` reserves a local signature operation with an internal
idempotency key; `/signatures/complete` verifies and settles it. The SDK/CLI
sign locally between these calls. Abandoned reservations are recovered by the
billing worker. The synchronous `/signatures` endpoint has been removed.

`POST /signatures/verify` verifies the original message or EIP-712 payload for
an actively granted wallet. It uses ERC-1271 for deployed accounts and ERC-6492
for counterfactual accounts, returns invalid signatures as `valid: false`, and
does not evaluate signature policies, consume billing usage, persist an
operation, or write an audit event. Verification has a separate 240
requests-per-minute actor rate limit.

`POST /wallets/passkey/registration-options` starts a five-minute WebAuthn
ceremony for a user with `wallet:create`. It returns ES256-only, resident-key,
user-verification-required options and replaces that user's older pending
ceremony in the active organization. `POST /wallets` completes that ceremony
when its discriminated owner is `passkey`. It also accepts
`{type: "namera-managed", provider: "1claw"}` for account creation and internal
owner signing. GCP requests still return 403 `MANAGED_WALLETS_DISABLED` before
provider or billing work. Managed creation is limited to 20 attempts/org/hour.
No public arbitrary owner-signing endpoint is exposed.
The passkey ceremony is consumed in the same
transaction as the root signing key, wallet, audit, notification, and email
writes.

API responses default to `Cache-Control: no-store`, including failures before
authentication and unexpected errors. Successful public OAuth discovery responses
retain their explicit five-minute cache policy; error responses always use no-store.
Authentication cookies
and existing redirect headers are preserved by the outer API security middleware,
which sets `nosniff`, frame denial, and a no-referrer policy. Dashboard document
CSP and passkey permissions are owned by the dashboard origin. Authentication cookies
use `Secure` outside development and omit it only when `NODE_ENV=development`.
If authorization finds
an invalid session or a session whose active membership no longer exists, it
also expires the stale `auth-token` cookie so the browser can recover cleanly.

`GET /wallets/:walletId/passkey-owner` requires a user with `wallet:read` in the
active organization. It returns only the public key and credential/RP identifiers
needed to review an owner approval, or a null owner for non-passkey wallets.
Machine actors cannot read this descriptor, even with wallet grants. Ordinary
wallet responses do not include credential metadata.

`@namera-ai/telemetry` exports logs, traces, and metrics over OTLP. HTTP tracing
uses one stable route-normalized span per request. It excludes the Scalar
reference, routine current-session probe, and telemetry proxy routes. Bounded
request count and duration metrics exclude telemetry proxy traffic.

The dashboard sends protobuf OTLP to `POST /t/traces/v1`, `/t/logs/v1`, and
`/t/metrics/v1`. The server forwards each signal to local LGTM in development
or its configured Axiom dataset in production, so provider credentials remain
server-side. These routes accept only OTLP JSON or protobuf, reject bodies over
2 MiB, apply a 10-second upstream timeout, disable caching, and use a dedicated
600 requests-per-minute per-IP limit.

## Waitlist API

`POST /waitlist` accepts an email publicly. New joins atomically queue a waitlist
confirmation email without creating an account. Duplicate joins do not resend.
Internal waitlist listing and acceptance are available at `/internal/waitlist`;
the old arbitrary-status and user-management routes remain removed.
Session-authorized invite listing, creation and revocation are available at
`/internal/invites`; see the [beta invite flow](../../architecture/auth/core/beta-invites.md).
Set optional `WAITLIST_CORS_ORIGIN`
to the landing page’s exact origin; only public submission allows it, without
cookies. See [waitlist architecture](../../architecture/auth/waitlist.md).

## Rate limiting

Request bodies are capped at 2 MiB (64 KiB for `/oauth/*`) before unbounded
allocation, including chunked requests. Declared oversize requests return 413;
stream overflow may return a decoding error or close the connection. Node uses
explicit 10-second header and 30-second request-receive deadlines, a 5-second
keep-alive timeout and 16 KiB header cap. These do not shorten application or
provider work after a request has been received.

The server uses Effect's process-local in-memory `RateLimiter`. One shared layer
backs both the global IP limit and stricter operation limits. Policies are kept
in `src/rate-limit.ts`; each counter is isolated by a namespaced key such as
`magic-link.request.ip:<address>`.

For a new sensitive operation, add its policy under `rateLimitPolicy`, then call
`consumeRateLimit` in the route before invoking the application method. Use a
stable, low-cardinality scope name and an appropriate identifier such as the
client address, authenticated user ID, organization ID, or normalized email.
Never include the identifier in logs or metric attributes.

Invitation creation currently has separate organization and normalized-recipient
limits in addition to the global limit. Magic-link request and verification use
their own IP/email policies.

API-key creation is limited to 20 attempts per active organization per hour.
Revocation is limited to 60 attempts per active organization per hour. Read
operations use only the global limit.

Managed session creation accepts the 1Claw signer variant and is limited to 20
attempts per active organization per hour, before any provider call. It creates
pending sessions under either passkey or 1Claw accounts, never approvals or active
grants. Both session custody types use the existing owner-operation endpoints:
passkey prepare/complete for passkey parents and managed prepare/approve for
1Claw parents. Only receipt confirmation activates an installation; revocation
immediately removes grants before owner-approved onchain removal. Managed session
execution/signing uses the unified `/executions/*` and `/signatures/*`
prepare/complete routes. Stored custody selects the signer; local completion requires
a signature and managed completion forbids one. They retain the existing delegated
actor scopes and rate limits. Managed client selection remains a separate phase.
Local creation is unchanged. No additional environment configuration is required.

Session-key revocation is limited to 60 attempts per active organization per
hour. It revokes the key and every active grant in one application transaction.

`GET /wallets/:walletId/portfolio` requires the same scoped `wallet:read` access
as the wallet detail route. `POST /portfolios/assets/query` exposes the same
provider-neutral portfolio for an explicit namespace-qualified address. Both
return paginated native and ERC-20 assets across supported EVM chains and
preserve per-chain Alchemy failures in the success response. Complete account
snapshots are cached in memory for five minutes (bounded to 500 keys per server).
Use `refresh=true` on the first page to refresh from Alchemy. Wallet authorization
is checked on every request, including cache hits. Provider credentials stay in
the EVM adapter.

Smart-account signatures are limited to 120 requests per API key per minute.
Smart-account signature verification is limited separately to 240 requests per
machine actor per minute.

`POST /rpc/eip155/:chainId` is limited separately to 600 requests per minute per
client IP. RPC traffic bypasses the lower global API limit and is validated
against the supported EVM chain registry before the body is forwarded to
Alchemy. The proxy preserves the upstream status and response body, applies a
30-second timeout, and never exposes the configured Alchemy API key.

Browser telemetry routes also bypass the lower global API limit because their
dedicated policy accounts for exporter batching traffic.

OAuth authorization and token endpoints use dedicated per-IP token-bucket
limits of 60 requests per minute. RFC 7591 public-client registration is
advertised at `/oauth/register` and limited to 20 requests per IP per hour.
Dynamically registered clients receive no secret and may use only exact HTTPS,
or loopback HTTP redirect URIs. OAuth protocol endpoints reject repeated
parameters and unexpected request media types. Authorization errors redirect
only after the registered callback is validated; invalid clients and callbacks
receive a local error response. PKCE uses the complete `S256` verifier and
challenge grammar, and refresh tokens remain bound to the canonical MCP
resource. Client ID Metadata Document resolution remains deferred until a newer
Effect MCP adapter makes it part of the selected compatibility target.
Authorization codes and tokens are opaque and stored only as hashes. Consent
approval and authorization revocation create organization audit events and
in-app notifications, but never email jobs.

The same authorization server exposes the RFC 8628 device grant for the
pre-registered `namera-cli` public client. Device approval creates a `cli` actor
with explicit session-key grants. Generic API authorization accepts its bearer
token only for the API-origin resource and enforces both OAuth scopes and
grants; CLI authorization does not emit email.

Authorization-code MCP tokens may also target the API origin for a local MCP
client. They retain their MCP actor identity and require `mcp:read` or
`mcp:execute` on delegated resource routes. API middleware checks client status,
active authorization, exact audience, and the current token's narrowed scopes.
Only API-origin resources are issued. Hosted `/mcp` transport and its resource
metadata are removed. `namera mcp serve` owns stdio, persistent MCP OAuth
credentials, SDK tool adapters, and local signing. The API retains MCP
consent, registration, tokens, and authorization list/get/revoke routes.
See [local MCP](../../architecture/clients/local-mcp.md) for the client boundary.

The in-memory store is suitable while the server runs as a single instance. It
resets on restart and does not coordinate between replicas. Before horizontally
scaling the server, replace `RateLimiter.layerStoreMemory` with Effect's Redis
store while retaining the policies and namespaced keys.

The server trusts load-balancer client-IP headers without environment switches
or CIDR configuration. The middleware prefers a valid `X-Real-IP`, then the
first address in a valid `X-Forwarded-For` chain. Missing or invalid headers fall
back to the socket peer. Chains must contain at most 32 valid IP addresses;
IPv6 and IPv4-mapped addresses are normalized. Other IP headers are ignored.
The deployment must overwrite both headers at ingress and block direct origin
access; otherwise callers can spoof their throttle identity.

Restrict origin access to ingress (for example, with a NetworkPolicy).
After deployment, compare HTTP span
`client.address` (socket peer) with `namera.client.address` (resolved limiter IP)
and `namera.client.ip_source` (`socket` or `forwarded`).

## Adding a handler

Authenticated handlers follow this order:

1. Yield `CurrentActor`, then call `enforceActor` with the allowed actor kinds
   and explicit per-actor permission requirements. Keep only the returned actor
   data.
2. Apply transport concerns required by that endpoint: rate limits, request
   metadata, cookies, cache headers, or response status.
3. Call one operation on `Application` and map domain values to public DTOs.

Handlers must not query repositories for business data or coordinate workflows.
Authorization and HTTP adaptation belong here; intrinsic business invariants and
transactions belong in `application`. Keep one route file per API group and use
the matching group/folder names from `@namera-ai/api`.

For shared read routes, convert the enforced actor with `toActorReadScope`.
User data intentionally omits `actorId` and therefore receives the
permission-authorized organization view. Machine actors include `actorId`, so
repositories restrict results through grants or actor ownership. Do not create a
parallel API-key route for the same resource.

## Environment

For private beta, set `AUTH_INVITE_REQUIRED=true` (default). `AdminAuthorization`
uses the normal HttpOnly user session and active owner/operator/viewer membership;
the shared `ADMIN_TOKEN` is no longer accepted. Team writes require an active session
and an approved Origin. Set `ADMIN_BOOTSTRAP_OWNER_EMAIL` to an existing verified
user's email to bootstrap the first owner automatically after startup migrations.
Unset/blank disables it; any existing owner makes it a no-op. Missing/unverified
users are skipped with a warning and retried on the next restart. Invalid email
syntax or database failures fail startup. Remove the variable after success. Set
`ADMIN_CORS_ORIGIN` for credentialed admin requests and invitation email links.
Platform-admin groups must opt into this middleware and enforce permissions.
See [admin authorization](../../architecture/auth/admin.md) and the
[signup flow](../../architecture/auth/core/beta-invites.md).

Copy `.env.example` to `apps/server/.env` for local development. Server-owned
values have defaults; composed package configuration remains required unless its
own README documents a default.

For production, start from [`.env.prod.example`](.env.prod.example), replace all
example origins and fill every required credential through your secret manager
or a private runtime env file. It includes Namespace ENS, Resend, Axiom,
PostgreSQL, cryptographic keys, and admin configuration. Self-custodial deployments
do not require GCP KMS credentials or server-side wallet-key storage.
The template is safe to commit; populated env files remain ignored and excluded
from container images.

| Variable             | Default                 | Purpose                                         |
| -------------------- | ----------------------- | ----------------------------------------------- |
| `NODE_ENV`           | `development`           | Runtime environment and cookie security policy. |
| `SERVER_HOST`        | `0.0.0.0`               | HTTP listen host.                               |
| `SERVER_PORT`        | `8080`                  | HTTP listen port.                               |
| `SERVER_CORS_ORIGIN` | `http://localhost:3000` | Allowed credentialed UI origin.                 |

The composition root also loads:

- PostgreSQL configuration from `@namera-ai/database`;
- authentication origins from `@namera-ai/application`;
- cryptographic secrets from `@namera-ai/crypto`;
- Alchemy RPC credentials and BSO policy configuration from `@namera-ai/evm`;
- independent `GcpService.disabledLayer` and `LocalService.disabledLayer` managed signers (no configuration);
- live 1Claw SDK and OIDC services with required Platform/template/trust configuration;
- local LGTM or production Axiom configuration from `@namera-ai/telemetry`;
- Resend configuration from `@namera-ai/emails` outside development.

Local configuration defaults are kept in `apps/server/.env.example`.
Package READMEs remain authoritative for each service's variables.

The dashboard and internal admin surfaces each use their configured exact origin;
credentialed requests never use a wildcard origin. The legacy admin SPA rebuild
is a separate step; see the admin architecture for rollout limitations.

All environments keep GCP and local-file signing disabled. Owner passkeys and local
session keys sign on the client. 1Claw is always composed, without an enable flag;
missing required provider/OIDC configuration fails startup. The API URL and
30-second provider timeout are code constants. Set `ONECLAW_ORG_EMAIL_DOMAIN`
to a domain Namera controls, and configure the dashboard-created Platform app and
pinned empty template. `ONECLAW_OIDC_ISSUER` must equal
`${AUTH_API_PUBLIC_ORIGIN}/providers/1claw`. Discovery and `jwks.json` are hosted
beneath that issuer and publish no private material or tokens. See the
[provider README](../../packages/wallet-providers/oneclaw/README.md) and
[account setup/recovery](../../architecture/wallets/accounts.md).
Set `TELEMETRY_SERVICE_VERSION` to the deployed release tag or Git SHA to identify
the version producing logs, traces, and metrics. It defaults to `development`
when omitted, so supply a meaningful value in production.

## Commands

```sh
pnpm --filter @namera-ai/server dev
pnpm --filter @namera-ai/server build
pnpm --filter @namera-ai/server start
pnpm --filter @namera-ai/server test
pnpm --filter @namera-ai/server typecheck:test
```

## Container image

Build the production server image from the workspace root.
`apps/server/Dockerfile` uses Turborepo's pruned-workspace flow and includes only the
server's production workspace graph in the final Node.js 24 image.
The builder explicitly copies the root `tsconfig.json` after pruning because
workspace packages extend it and Turbo does not include it in `out/full`.

```sh
docker build --file apps/server/Dockerfile --tag namera-server .
docker run --rm --publish 8080:8080 --env-file /path/to/server.env namera-server
```

Runtime configuration is supplied when the container starts; `.env` files are
excluded from the Docker build context and are never copied into the image.

Server feature tests live in `tests/integration/` and exercise the typed in-memory HTTP API
against the real application, repositories, transactions, authorization, and
PGlite migrations. Shared setup lives in `tests/fixtures/`; provider substitutes come from their owning packages.
See [Testing architecture](../../architecture/engineering/testing.md) before
adding tests.

Start PostgreSQL and the local Grafana LGTM stack before the development server:

```sh
pnpm dev:services:up
```

PostgreSQL is available at `localhost:5432` using the credentials in
`.env.example`. Grafana is available at `http://localhost:3001`; OTLP/HTTP is
available at `http://localhost:4318`.

Use `pnpm dev:services:logs` to follow container logs and
`pnpm dev:services:down` to stop the stack. Named volumes preserve database and
LGTM data between restarts.
