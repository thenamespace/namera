# Billing

Billing is organization-scoped: every organization has its own billing account
and subscription history. Organization records do not duplicate plan state.

## Plan catalog

`src/billing/data.ts` is the code-owned entitlement catalog. A subscription
stores both the plan key and plan version so existing subscriptions keep the
limits they were assigned when a future catalog version is introduced.

The only current plan is `free` version 1:

| Entitlement                 | Value |
| --------------------------- | ----: |
| Monthly price               |    $0 |
| Members                     |     5 |
| Software wallets            |     5 |
| HSM-backed wallets          |     0 |
| Included executions / month |   100 |
| Execution overage           |  none |

Import the catalog from the application package:

```ts
import { billingPlans } from "@namera-ai/application";

const limits = billingPlans.free.limits;
```

Keep limits small and product-oriented. Add a new plan version when changing
limits for newly assigned subscriptions; do not silently change the meaning of
an already persisted version.

## Persistence

- `billing.account` owns the one-to-one organization billing identity and an
  optional provider customer reference.
- `billing.subscription` stores plan/version history. A partial unique index
  permits only one current subscription per organization.
- `billing.provider_event` is an idempotent inbox for future provider webhooks.

The free plan does not require a provider customer or billing period. Paid
provider integrations may populate those fields later.

## Entitlements

Every organization-creation transaction inserts its billing account and active
free subscription. `application.billing.get` resolves the stored plan/version
against `billingPlans` and returns limits with current organization usage.

Active members and unexpired pending invitations both consume member capacity.
Invitation creation locks the billing-account row before checking usage, so
concurrent requests cannot reserve more seats than the plan allows. Active
software and HSM wallets consume their respective capacities independently.
The wallet workflow must call `enforceWalletLimit` inside the same transaction
that persists a wallet. The free plan has no overage: an operation past a limit
must be rejected.

## Deferred

Stripe synchronization, paid-plan mutations, transaction metering, and dashboard
UI remain deferred. Follow the repository root `STRIPE.md` for the planned
catalog, subscription, metering, webhook, and rollout configuration.
