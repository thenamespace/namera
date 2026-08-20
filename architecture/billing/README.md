# Billing and entitlements

Billing is organization-scoped. Namera's code-owned, versioned plan catalog is
authoritative for product entitlements; persistence records which plan/version
an organization uses and future provider synchronization state.

## Plan catalog

| Plan        | Monthly price | Members | Software wallets | HSM wallets | Executions/month | Signatures/month | Execution overage |
| ----------- | ------------: | ------: | ---------------: | ----------: | ---------------: | ---------------: | ----------------: |
| Free v1     |            $0 |       5 |                5 |           0 |              100 |           10,000 |          hard cap |
| Pro v1      |           $49 |      20 |               20 |           3 |            2,000 |          250,000 |             $0.02 |
| Business v1 |          $249 |     100 |              100 |          10 |           10,000 |        1,000,000 |             $0.02 |

Only Free activation is implemented. Pro and Business values define the future
entitlement contract but are not assignable through a public mutation.

## Tables

### `billing.account`

One row per organization; `organization_id` is the primary key. Optional
provider and provider-customer ID must be both null or both present. A partial
unique index prevents one provider customer from mapping to multiple accounts.
The row also stores billing email, currency, and timestamps. Application
workflows lock this row to serialize capacity reservations.

### `billing.subscription`

Stores historical subscriptions with organization, optional provider
subscription identity, plan/version, lifecycle status, optional paired period
start/end, cancellation flag, end time, typed provider data, and timestamps.

Constraints enforce:

- one current `trialing`, `active`, or `past_due` row per organization;
- unique provider subscription identity when present;
- plan version at least 1;
- both period timestamps or neither, with end after start;
- provider and provider subscription both present or both absent.

Indexes support organization history and status/period processing.

### `billing.provider_event`

Future provider webhook inbox with provider event identity, type, live mode,
typed data, pending/processed/failed state, attempts, provider timestamp,
processed time, bounded last error, and timestamps. Provider/event ID is unique;
status/creation is indexed for a worker.

## Initialization

Personal and explicitly created organizations insert a provider-null billing
account and active Free v1 subscription inside the organization-creation
transaction.

## Usage calculation

Usage is derived from authoritative domain rows rather than increment-only
counters:

- members: active memberships;
- pending invitations: live pending rows, combined with members for seat limit;
- software/HSM wallets: active wallets joined to key protection;
- executions: current-month non-failed submissions/confirmed operations;
- signatures: current-month succeeded operations plus unexpired reservations.

`GET /billing` returns persisted plan/version/status, resolved limits, and
current usage to a user actor with `billing:read`.

## Enforcement

```mermaid
sequenceDiagram
  participant Workflow
  participant Tx as SQL transaction
  participant Account as billing.account
  participant Usage as Domain usage queries
  participant Resource as Domain repository

  Workflow->>Tx: begin
  Tx->>Account: SELECT ... FOR UPDATE
  Tx->>Usage: load current subscription and usage
  alt below limit
    Tx->>Resource: insert invitation/wallet/submission/signature reservation
    Tx-->>Workflow: commit
  else limit reached
    Tx-->>Workflow: BillingLimitExceededError; rollback
  end
```

Invitation creation counts active members plus pending invitations. Wallet
creation performs an early check but repeats the locked check in the persistence
transaction after external key/account creation. Execution and signature
reservation lock before creating their operation row. Definitive failures stop
consuming derived usage; live reservations prevent concurrent overrun.

## Planned Stripe boundary

Namera remains authoritative for entitlements, access decisions, and local usage
records. Stripe would be authoritative for customers, payment methods, invoices,
subscription item/payment state, and aggregation of delivered meter events.

A paid subscription is planned as one base-price item, one graduated execution
meter item, and an optional licensed additional-HSM quantity. Every successful
paid execution must first create a durable local usage-outbox record and later
send an idempotent meter event; Stripe calls must not occur inside execution
settlement.

Provider state changes must originate from verified, idempotently stored webhook
events processed by a worker. A Checkout success redirect never grants a plan.
Subscription provider `data` must become a versioned discriminated schema before
storing Stripe item IDs and HSM quantity.

## Pending

- Implement provider service, Checkout/portal mutations, raw-body Stripe webhook
  verification, provider-event processing, and explicit subscription-status
  access mapping.
- Add a durable execution-usage outbox and idempotent meter delivery worker.
- Add billing audit events, metrics, and dashboard plan/usage UI.
- Add explicit purchase/removal for additional HSM slots; wallet creation must
  never silently increase a recurring charge.
- Decide paid signature overage before adding a signature meter.
- Keep the pricing calculator, code-owned catalog, and configured Stripe prices
  synchronized when paid plans are enabled.
