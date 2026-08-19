# Billing

Billing is organization-scoped: every organization has its own billing account
and subscription history. Organization records do not duplicate plan state.

## Plan catalog

`src/billing/data.ts` is the code-owned entitlement catalog. A subscription
stores both the plan key and plan version so existing subscriptions keep the
limits they were assigned when a future catalog version is introduced.

The current code-owned catalog contains version 1 of each launch plan:

| Entitlement                 |   Free |     Pro |  Business |
| --------------------------- | -----: | ------: | --------: |
| Monthly price               |     $0 |     $49 |      $249 |
| Members                     |      5 |      20 |       100 |
| Software wallets            |      5 |      20 |       100 |
| HSM-backed wallets          |      0 |       3 |        10 |
| Included executions / month |    100 |   2,000 |    10,000 |
| Included signatures / month | 10,000 | 250,000 | 1,000,000 |
| Execution overage           |   none |   $0.02 |     $0.02 |

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
Wallet creation performs an early capacity check before remote key creation and
repeats `enforceWalletLimit` while holding the billing-account lock in the
transaction that persists the wallet. Execution reservation uses the same lock
and counts current-month active submissions plus confirmed executions so
concurrent requests cannot exceed the included allowance. Definitively failed
submissions release that derived capacity. The free plan has no overage: an
operation past a limit is rejected.

Signature requests reserve capacity under the same billing-account lock before
calling the key provider. Current-month successful operations and unexpired
reservations consume the signature allowance; a definitive provider failure
marks the reservation failed and releases its capacity. Signature limits are
hard caps for all plans until paid signature overage is designed explicitly.

## Deferred

Stripe synchronization, paid-plan mutations, paid usage-event delivery, and
dashboard billing UI remain deferred. Follow the repository root `STRIPE.md`
for the planned catalog, subscription, metering, webhook, and rollout
configuration.
