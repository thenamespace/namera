# @namera-ai/application

The backend use-case layer and center of Namera's business logic. It composes
repositories and provider services into raw operations such as magic-link sign
in, organization management, wallet and session-key creation, API-key grants,
policy-gated execution, and signing. It is independent of HTTP and does not
perform API authorization checks; `apps/server` owns those checks and adapts
HTTP requests to application methods.

See [backend workspace architecture](../../architecture/packages/backend.md)
for use-case ownership, transaction boundaries, and the application-to-server
composition model.

## Structure

- `src/application.ts` — the single aggregate `Application` service and live layer.
- `src/audit/` — internal typed audit-event writer used by application workflows.
- `src/auth/core/` — focused user and session operations.
- `src/auth/core/api-key.ts` — API-key creation, grant-aware reads, and atomic
  credential/grant revocation.
- `src/auth/magic-link/` — request and verification workflows.
- `src/auth/oauth/` — OAuth authorization requests, browser and CLI device
  consent, delegated authorization management, PKCE/device exchange, refresh
  rotation, and token revocation.
- `src/auth/organization/` — organization, member, invitation, and setup operations.
- `src/auth/organization/helpers.ts` — shared transactional user and organization setup.
- `src/auth/config.ts` — environment-backed authentication configuration.
- `src/auth/data.ts` — code-owned authentication policy and defaults.
- `src/billing/` — code-owned plan registry, anniversary periods, generic
  transactional metering, and recovery/reconciliation orchestration.
- `src/notification/` — notification policy, transactional creation, inbox, and preferences.
- `src/session-key/` — separately composed creation, revocation, relation-view,
  and organization- or actor-scoped read workflows plus canonical policy hashing.
- `src/signature/` — shared account/grant resolution, signature-operation
  lifecycle, and separate policy-gated signing and read-only verification
  builders composed behind one application surface.
- `src/execution/` — synchronous execution orchestration, transactional lifecycle
  settlement/release, lease-based background reconciliation, and scoped reads.
- `src/wallet/` — separately composed creation, metadata update, and
  organization- or actor-scoped wallet read workflows.

Future feature folders should add a focused operation builder to the aggregate
service. Infrastructure capabilities remain focused `Context.Service` values
that the aggregate can consume.

## Adding an operation

1. Put the operation in the smallest matching feature file and expose it through
   the existing `Application` aggregate; do not create a parallel application
   service for each entity.
2. Yield repositories and capability services once in the feature builder. Define
   the public operation with `Effect.fn("application.feature.operation")`.
3. Enforce business invariants here, but leave HTTP actor permissions, cookies,
   headers, and status codes in `apps/server`.
4. Wrap dependent writes in `TransactionService.run`. Repository calls inside
   it automatically use the same transaction. Enqueue required emails inside
   that boundary through `EmailJobs`; never wait for provider delivery in an
   HTTP workflow.
5. Append the typed audit event inside that transaction for successful state
   changes. Do not audit reads or failed changes. Add or update the event union
   in `protocol` first.
6. Add a shared metric only for useful aggregate behavior and bounded labels.
   Emit short semantic logs at meaningful transitions; never log credentials,
   email content, or arbitrary request payloads in shared or production layers.
   Provider-owned local development layers may deliberately expose test data,
   as documented by that provider package.
7. Add the provider test layer in the owning package and exercise the operation
   through server feature tests.

Notification-producing workflows call the shared creator inside their business
transaction. It writes the occurrence and recipients, maps each notification
type to a category/topic policy, resolves organization then global email
overrides before the policy default, and optionally enqueues a durable email
job. In-app recipients are always created and are not controlled by user
preferences.

## Usage

```ts
import { Effect } from "effect";
import * as Application from "@namera-ai/application";

const program = Effect.gen(function* () {
  const app = yield* Application.Application;
  return yield* app.organization.invitation.createInvitation(input);
});
```

`Application.layer` is the only application layer provided by the server.

Organization creation initializes a providerless billing account, active Free
v1 subscription, one-month organization-anniversary period, and one balance per
Free meter in its existing transaction. The period begins at the organization's
exact creation instant rather than a calendar-month boundary. Resource-limited
workflows lock the organization billing account and use current domain-row
counts. Metered workflows create their domain operation and generic billing
reservation together, then atomically settle or release it through an immutable
usage ledger. The billing worker advances anniversary periods, recovers expired
reservations, and repairs projections. Namespace packages own their measurement
rules; application only coordinates their results with persistence. See
[Billing and entitlements](../../architecture/billing/README.md) for the exact
semantics.

Wallet creation performs a cheap quota precheck, creates the provider key and
chain account, then repeats the locked quota check before atomically persisting
the key, wallet, audit events, notification recipients, and durable email jobs.
Provider key deletion is intentionally not part of the current service, so a
failed final transaction may leave an unreferenced provider key for later
operational reconciliation.

Session-key creation validates the organization wallet and its namespace before
persisting versioned policy instances. Registry-owned cardinality rejects a
second instance only for policy types declared singleton; repeatable types and
the total policy array have no product-level maximum. The same registry assigns
IDs and code-owned applicability without application policy switches. Revocation
atomically marks the immutable key revoked and revokes all active grants while
preserving in-flight execution history. Policy hashes are purpose-separated and
canonical across object-key and policy-array ordering while excluding generated
policy IDs. The session key, audit event, inbox recipients, and durable email
jobs share one transaction.

API-key creation validates all requested active session keys in the organization,
derives a required expiration from the requested duration using the server clock,
generates and hashes the credential, then atomically creates the API-key actor,
credential row, grants, audit event, inbox recipients, and durable email jobs.
Durations are limited to one year. The raw credential is returned only from
creation; get and list return safe key details with their currently authorized
session keys.

OAuth authorization accepts active public clients created through pre-registration
or RFC 7591 dynamic registration, exact redirect URIs, PKCE `S256`, and the
canonical `/mcp` resource. Dynamic registration issues an opaque public client
ID without a secret and accepts only HTTPS or loopback HTTP redirect URIs.
Authorization-code challenges and verifiers use the strict RFC 7636 grammar,
and refresh rotation requires the token's original resource. Browser approval
atomically creates an `mcp` actor, its selected session-key grants, a hashed
one-time authorization code, an organization audit event, and in-app
notification recipients. Revocation atomically invalidates the authorization,
all active tokens, and all grants, with matching audit and in-app notification
records. These workflows intentionally do not enqueue emails.

The first-party CLI uses the RFC 8628 device grant. Approval creates a `cli`
actor and selected session-key grants in the same transaction as its audit event
and in-app notification. Token polling consumes an approved request once and
reuses the existing access/refresh token lifecycle; it never sends email.

Wallet updates replace only metadata and leave the namespace, implementation,
address, protection level, key material, and account data unchanged. No-op
updates do not create duplicate audit events or metrics.

Execution requests reserve one granted session key, persist the exact signed
UserOperation, submit it, and briefly wait for its receipt. A successful receipt
settles policy state and creates the execution in the same transaction. A
definitive failure releases policy state. Timeout or uncertain RPC outcomes
return `submitted`; `Application.execution.reconcile` later claims a bounded
batch with database leases and performs the same settle/release lifecycle.
Before reservation, the EVM policy registry derives any missing state rows from
the prepared intent context. Application code inserts those generic seeds and
locks only the referenced policy/state keys in stable order without branching
on policy types. Periodic allowance settlement remains attached to the exact
window in which the execution was authorized, even when confirmation occurs in
a later window.

Execution simulation prepares the same unsigned operation and normalized call
simulation as execution, then previews every eligible session key against its
current policy state. It returns the first allowed session key or each
candidate's first deterministic policy denial. The preview does not reserve or
settle policy state, sign or submit an operation, create execution records,
consume billing usage, or emit audit events, so its authorization result is
point-in-time only.

Submission status reads require the creating API-key actor identity. Wallet,
session-key, and confirmed-execution reads accept an optional actor scope. An
omitted actor ID returns the permission-authorized organization view for users;
an actor ID returns only wallets and session keys reachable through active
grants and executions started by that actor. Confirmed execution list results
retain their account, session key, and initiating actor view for transport
mapping. Keep this distinction in one use case rather than duplicating
machine-specific operations.

Signature requests are synchronous and idempotently reserved. They require an active
API-key grant to an active wallet session key with an explicit `evm.signature`
policy, evaluate the signature-specific context and time window, reconstruct
the account, enforce the organization monthly signature allowance, and call
`evm.sign`. The persisted operation uses a discriminated message/typed-data
payload and records its digest, policy hash, actor, grant, and lifecycle. The
returned signature bytes are never stored or logged. Success and its safe
organization audit event share one transaction; definitive signing failures
release reserved billing capacity. Signature workflows do not enqueue
notifications or emails.

Signature verification is a separate read-only workflow. It requires an active
machine-actor grant to the requested wallet but does not require signature
authority, evaluate policies, reserve billing, persist an operation, or write an
audit event. It reconstructs the smart account and delegates deployed ERC-1271
or counterfactual ERC-6492 verification to `evm.verifySignature`.

Successful mutations append audit events in the same `TransactionService.run`
boundary as the state change. Read-only operations are not audited. Audit data
must remain safe historical context and must never contain credentials.

Member administration uses permission dominance as a partial role hierarchy.
An actor may manage only roles whose permissions are a strict subset of their
own and may assign only roles whose permissions are also a strict subset. This
means an Admin cannot assign the Admin role to another member. The system Owner
role is never assignable through invitations or generic member administration,
and existing owners cannot be modified or removed. A future ownership transfer
must be a separate explicit workflow that preserves the single-owner invariant.

## Environment

| Variable                       | Required | Purpose                           |
| ------------------------------ | -------- | --------------------------------- |
| `AUTH_API_PUBLIC_ORIGIN`       | Yes      | Public origin of `api.namera.ai`. |
| `AUTH_DASHBOARD_PUBLIC_ORIGIN` | Yes      | Public dashboard origin.          |

Editable TTLs, limits, cookie settings, and return paths live in
`src/auth/data.ts` rather than environment variables.

## Configuration and crypto

```ts
import { Effect, Layer } from "effect";
import { NodeCrypto } from "@effect/platform-node";
import { AuthConfig } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";

const CryptoLive = CryptoService.layer.pipe(Layer.provide(NodeCrypto.layer));

const program = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  return yield* crypto.randomToken(config.magicLink.tokenBytes);
});
```

Effect's `Crypto` service provides secure randomness and SHA digests. The
shared crypto service adds purpose-separated HMAC and AES-GCM operations.
`apps/server` must provide `NodeCrypto.layer`.

Do not import API route definitions or read `process.env` in application use
cases. Validate public input in protocol/API schemas and keep use cases focused
on business behavior and atomic coordination.
