# Stripe billing setup

This document describes the intended Stripe configuration for Namera. The
current application defines Free, Pro, and Business entitlements locally, but
new organizations still start on Free. Paid-plan mutations, Stripe
synchronization, and paid usage metering remain planned work.

The editable pricing model lives in `script/calculate-margin.ts`; `pricing.md`
is generated from it. Keep the application plan catalog and Stripe prices in
sync with that source before enabling a paid plan.

## Pricing model

| Plan     | Monthly | Members | Software wallets | HSM wallets | Executions / month | Signatures / month | Execution overage |
| -------- | ------: | ------: | ---------------: | ----------: | -----------------: | -----------------: | ----------------: |
| Free     |      $0 |       5 |                5 |           0 |                100 |             10,000 |          hard cap |
| Pro      |     $49 |      20 |               20 |           3 |              2,000 |            250,000 |             $0.02 |
| Business |    $249 |     100 |              100 |          10 |             10,000 |          1,000,000 |             $0.02 |

An additional HSM wallet slot is planned at **$7/month**. Scale and Enterprise
should use negotiated prices and entitlements rather than sharing a public
price.

Members, software-wallet capacity, and included HSM capacity are application
entitlements. They are not Stripe quantities. Only additional HSM capacity is a
recurring quantity.

## Stripe catalog

Create the following products and USD monthly prices in both Stripe sandbox and
live mode. Sandbox and live objects have different IDs.

### Base plans

| Product         | Price              | Type                    |
| --------------- | ------------------ | ----------------------- |
| Namera Pro      | $49 / month        | Recurring, flat rate    |
| Namera Business | $249 / month       | Recurring, flat rate    |
| Namera Scale    | Contract-dependent | Created per sales quote |

Do not create a Stripe subscription for Free organizations. Their local
`billing.account` and `billing.subscription` records remain provider-null.

### Executions

Create one meter:

```text
Display name: Namera executions
Event name: namera_executions
Aggregation: Sum
Customer key: stripe_customer_id
Value key: value
```

Create two recurring usage-based prices attached to that meter:

| Price                      | Graduated tiers                               |
| -------------------------- | --------------------------------------------- |
| Pro execution overage      | First 2,000 at $0; every later unit at $0.02  |
| Business execution overage | First 10,000 at $0; every later unit at $0.02 |

Use graduated pricing so only units above the included allowance are charged.
Every successful billable execution must still be reported; do not send only
the overage units.

### Additional HSM wallets

Create one product and recurring price:

```text
Product: Namera additional HSM wallet
Price: $7 / month / unit
Usage type: Licensed quantity
```

The subscription item quantity represents purchased slots beyond the plan's
included allowance:

```text
allowed HSM wallets = included HSM wallets + purchased HSM quantity
```

Changing this quantity is a subscription update and can be prorated. It is not
a meter event. Require an explicit purchase or removal action before changing
the quantity; wallet creation must never silently increase a recurring charge.

Before reducing the quantity, require the organization to retire enough HSM
wallets to fit the resulting entitlement.

### Sponsored gas

Sponsored gas is separate from the $0.02 execution charge. The current margin
model applies a 25% markup to Pimlico's complete sponsored-gas invoice. Keep
this disabled until transaction settlement data is available and the rounding,
refund, and failed-operation rules are defined.

When implemented, record the final customer charge in integer micro-USD units
and report it through a separate sum meter. Do not send floating-point dollar
amounts or mix gas cost into the execution count.

## Subscription composition

A paid organization has one Stripe Customer and one Stripe Subscription. The
subscription contains:

```text
Pro:
  - Namera Pro base price, quantity 1
  - Pro execution overage price
  - Additional HSM wallet price, only when quantity is greater than 0

Business:
  - Namera Business base price, quantity 1
  - Business execution overage price
  - Additional HSM wallet price, only when quantity is greater than 0
```

Stripe combines the fixed recurring and usage-based items on one invoice. The
base fee is billed in advance; metered execution usage is billed in arrears.

## Namera ownership

Namera remains authoritative for:

- the mapping from plan/version to product entitlements;
- active member, wallet, execution, and signature counts;
- whether an operation is allowed;
- durable execution usage records and their delivery status;
- organization authorization for billing changes.

Stripe is authoritative for:

- customers, payment methods, invoices, and collected payments;
- subscription items and purchased HSM quantity;
- subscription payment state and billing-period boundaries;
- Stripe's aggregation of reported paid-plan meter events.

Never grant a plan from a Checkout redirect alone. Apply billing state after a
verified webhook has been stored and processed.

## Local record mapping

Use the existing billing tables as follows:

- `billing.account.providerCustomerId` stores the Stripe Customer ID.
- `billing.subscription.providerSubscriptionId` stores the Stripe Subscription
  ID.
- `billing.subscription.plan` and `planVersion` select the local entitlement
  catalog.
- `billing.subscription.currentPeriodStart` and `currentPeriodEnd` mirror the
  Stripe period used for execution accounting.
- `billing.subscription.data` stores typed provider details such as base,
  execution, and HSM subscription-item IDs and the purchased HSM quantity.
- `billing.provider_event` is the idempotent webhook inbox, keyed by Stripe
  event ID.

Before implementing Stripe, replace the unstructured subscription `data`
contract with a versioned Effect Schema union. Also decide explicit local
access behavior for every Stripe subscription status; do not silently collapse
statuses such as `incomplete`, `unpaid`, or `paused` into `past_due`.

Attach only lookup metadata to Stripe objects:

```text
organizationId
plan
planVersion
```

Do not place permissions, secrets, or the full entitlement configuration in
Stripe metadata.

## Upgrade flow

1. Enforce an authenticated organization actor with `billing:update`.
2. Lock the organization's billing account.
3. Create or reuse its Stripe Customer with an idempotency key derived from the
   organization and operation.
4. Create a hosted Checkout Session in subscription mode for the selected base
   and execution prices.
5. Put `organizationId`, `plan`, and `planVersion` in metadata.
6. Redirect the browser to Checkout.
7. On Stripe webhook delivery, verify the raw-body signature, insert the event
   into `billing.provider_event`, and return `2xx` quickly.
8. A worker processes the inbox event, retrieves the latest Stripe subscription,
   and updates the local account/subscription projection transactionally.
9. The dashboard observes the resulting local billing state; the success URL is
   informational only.

Use a custom Namera flow for plan changes and additional HSM quantities. The
Stripe customer portal can initially handle payment methods, invoices, and
cancellation. Subscriptions combining multiple products and usage-based prices
have customer-portal update limitations.

## Execution metering

Create a durable local usage record for every billable execution, including
those inside the allowance. Use the logical execution ID as its idempotency
identity.

```text
successful execution
  -> insert local usage record
  -> usage worker claims unsent records in bounded batches
  -> send Stripe meter event with value=1
  -> store provider event identifier and sent timestamp
```

For Free, never call Stripe. Count local period usage and reject execution 101
because overage is `null`.

For Pro and Business, send every successful execution to Stripe. Stripe applies
the zero-cost included tier and the paid overage tier. Meter ingestion is
asynchronous, so Namera must use its local counter for real-time limits and
spending controls.

Signature operations are currently a local hard-capped entitlement on every
plan. Successful operations are derived from the local signature-operation
ledger; live reservations also consume capacity to prevent concurrent requests
from crossing the limit. Do not create a Stripe signature meter until signature
overage pricing is intentionally introduced.

The worker must use bounded retries with backoff. Each Stripe meter event needs
a stable unique identifier so retrying cannot double-count usage. Monitor
Stripe's asynchronous meter-error events as well as synchronous API failures.

## Webhooks

Expose one unauthenticated endpoint, for example:

```text
POST /webhooks/stripe
```

Verify `Stripe-Signature` against the exact raw request body before decoding the
event. Store accepted events idempotently, respond quickly, and process them in
a worker. Do not perform the full billing workflow inside the request.

Subscribe to the minimum required snapshot events:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

When usage metering is enabled, also configure the relevant thin-event
destination for meter ingestion errors. Webhook order is not guaranteed; when
applying subscription state, retrieve the current Stripe resource instead of
assuming the event payload is the latest state.

## Runtime configuration

Load secrets with Effect `Config.redacted`. Price IDs are deployment-specific
configuration because sandbox and live catalogs differ.

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRO_MONTHLY_PRICE_ID
STRIPE_PRO_EXECUTION_PRICE_ID
STRIPE_BUSINESS_MONTHLY_PRICE_ID
STRIPE_BUSINESS_EXECUTION_PRICE_ID
STRIPE_HSM_ADDON_PRICE_ID
STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID
```

Add sponsored-gas price or meter identifiers only when that feature is enabled.
A publishable key is unnecessary when Namera uses hosted Checkout and creates
sessions on the server.

## Rollout order

1. Keep Free entirely local and enforce members, software wallets, HSM wallets,
   and executions.
2. Add the Stripe provider adapter, raw webhook route, provider-event worker,
   and subscription status mapping.
3. Configure sandbox products, prices, meter, Checkout, and customer portal.
4. Implement Pro upgrade and cancellation without HSM add-ons.
5. Add the durable execution-usage outbox and meter worker.
6. Add explicit additional-HSM capacity purchasing and proration previews.
7. Add Business, then sponsored-gas settlement.
8. Repeat the catalog and webhook setup in live mode and switch only production
   environment IDs.

## Verification checklist

- Free organizations never create Stripe Customers or Subscriptions.
- Checkout retries do not create duplicate customers or subscriptions.
- The success redirect cannot grant paid access.
- Duplicate webhook deliveries create one provider-event row.
- Invalid webhook signatures are rejected before JSON processing.
- Plan and HSM quantity changes are reflected only after webhook processing.
- Pro executions 1-2,000 cost $0 in the metered line; 2,001 costs $0.02.
- Business executions 1-10,000 cost $0; 10,001 costs $0.02.
- Free execution 101 is rejected and never sent to Stripe.
- Additional HSM quantity is charged at $7 per month per slot with the intended
  proration behavior.
- Failed, retried, and duplicate executions cannot be double-metered.
- Cancellation and failed-payment access policies match the local subscription
  status.
- Sandbox webhook and meter-error flows are exercised with the Stripe CLI.

## Stripe references

- [Recurring pricing models](https://docs.stripe.com/products-prices/pricing-models)
- [Tiered and graduated prices](https://docs.stripe.com/subscriptions/pricing-models/tiered-pricing)
- [Subscription quantities](https://docs.stripe.com/billing/subscriptions/quantities)
- [Usage-based billing lifecycle](https://docs.stripe.com/billing/subscriptions/usage-based/how-it-works)
- [Configure a meter](https://docs.stripe.com/billing/subscriptions/usage-based/meters/configure)
- [Record meter events](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api)
- [Subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Webhook security](https://docs.stripe.com/webhooks)
- [Customer portal integration](https://docs.stripe.com/customer-management/integrate-customer-portal)
