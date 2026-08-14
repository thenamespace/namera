# @namera-ai/application

The backend use-case layer and center of Namera's business logic. It composes
repositories and provider services into raw operations such as magic-link sign
in, session management, and future backend workflows. It is independent of HTTP
and does not perform API authorization checks; `apps/server` owns those checks
and adapts HTTP requests to application methods.

## Structure

- `src/application.ts` — the single aggregate `Application` service and live layer.
- `src/audit/` — internal typed audit-event writer used by application workflows.
- `src/auth/core/` — focused user and session operations.
- `src/auth/magic-link/` — request and verification workflows.
- `src/auth/organization/` — organization, member, invitation, and setup operations.
- `src/auth/organization/helpers.ts` — shared transactional user and organization setup.
- `src/auth/config.ts` — environment-backed authentication configuration.
- `src/auth/data.ts` — code-owned authentication policy and defaults.
- `src/billing/` — code-owned billing plan and entitlement catalog.
- `src/notification/` — notification policy, transactional creation, inbox, and preferences.
- `src/session-key/` — immutable session-key creation, canonical policy hashing, and reads.
- `src/wallet/` — wallet creation and organization-scoped wallet reads.
- `BILLING.md` — organization billing model and plan-versioning rules.
- `MAGIC_LINK.md` — implementation contract for magic-link authentication.

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

Organization creation initializes an active free billing subscription in its
existing transaction. Quota-sensitive workflows lock the organization billing
account, resolve the stored plan/version through `billingPlans`, check current
usage, and create the resource before that transaction commits. Pending
invitations reserve member capacity. See `BILLING.md` for the exact semantics.

Wallet creation performs a cheap quota precheck, creates the provider key and
chain account, then repeats the locked quota check before atomically persisting
the key, wallet, audit events, notification recipients, and durable email jobs.
Provider key deletion is intentionally not part of the current service, so a
failed final transaction may leave an unreferenced provider key for later
operational reconciliation.

Session-key creation validates the organization wallet and its namespace before
persisting versioned policy instances. Policy hashes are purpose-separated and
canonical across object-key and policy-array ordering while excluding generated
policy IDs. The session key, audit event, inbox recipients, and durable email
jobs share one transaction.

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
