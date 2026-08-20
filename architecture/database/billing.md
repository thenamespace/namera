# Billing tables

Billing is organization-scoped. The database stores billing identity, subscription entitlement state, and an idempotent webhook inbox. Usage is derived from product operation records rather than maintained as an unauditable mutable counter.

Source: [`packages/database/src/schema/billing`](../../packages/database/src/schema/billing).

## `billing.account`

One billing identity per organization, whether free/local or attached to a payment provider.

| Column                 | PostgreSQL type | Required | Default | Description                                                          |
| ---------------------- | --------------- | -------- | ------- | -------------------------------------------------------------------- |
| `organization_id`      | `text`          | Yes      | —       | Primary key and owning organization.                                 |
| `provider`             | `text`          | No       | `NULL`  | Billing-provider discriminator. Null for providerless/free accounts. |
| `provider_customer_id` | `text`          | No       | `NULL`  | Provider customer identifier.                                        |
| `billing_email`        | `text`          | No       | `NULL`  | Invoice/contact email.                                               |
| `currency`             | `text`          | Yes      | `usd`   | Billing currency.                                                    |
| `created_at`           | `timestamptz`   | Yes      | `now()` | Creation time.                                                       |
| `updated_at`           | `timestamptz`   | Yes      | `now()` | Last provider/profile update.                                        |

### Keys and uniqueness

- Primary key: `organization_id`; this enforces one billing account per organization.
- Partial unique (`provider`, `provider_customer_id`) where customer ID is non-null.

### Foreign keys

- `organization_id` → `auth.organization.id`, `ON DELETE RESTRICT`.

### Checks

- Provider pair: `provider` and `provider_customer_id` must both be null or both non-null.

### Indexes

- Primary-key index on `organization_id`.
- Partial provider-customer unique index described above.

## `billing.subscription`

Entitlement-bearing subscription history. Free subscriptions can exist without a remote provider; paid/trial subscriptions bind a provider subscription ID.

| Column                     | PostgreSQL type | Required | Default  | Description                                                         |
| -------------------------- | --------------- | -------- | -------- | ------------------------------------------------------------------- |
| `id`                       | `text`          | Yes      | UUIDv7   | Subscription identifier.                                            |
| `organization_id`          | `text`          | Yes      | —        | Billing account.                                                    |
| `provider`                 | `text`          | No       | `NULL`   | Payment provider.                                                   |
| `provider_subscription_id` | `text`          | No       | `NULL`   | Provider subscription identifier.                                   |
| `plan`                     | `text`          | Yes      | `free`   | Stable plan key.                                                    |
| `plan_version`             | `integer`       | Yes      | `1`      | Version of the entitlement definition applied to this subscription. |
| `status`                   | `text`          | Yes      | `active` | Subscription lifecycle state.                                       |
| `current_period_start`     | `timestamptz`   | No       | `NULL`   | Provider/current entitlement period start.                          |
| `current_period_end`       | `timestamptz`   | No       | `NULL`   | Provider/current entitlement period end.                            |
| `cancel_at_period_end`     | `boolean`       | Yes      | `false`  | Cancellation scheduling flag.                                       |
| `ended_at`                 | `timestamptz`   | No       | `NULL`   | Terminal end time.                                                  |
| `data`                     | `jsonb`         | Yes      | `{}`     | Provider/plan-discriminated subscription metadata.                  |
| `created_at`               | `timestamptz`   | Yes      | `now()`  | History row creation time.                                          |
| `updated_at`               | `timestamptz`   | Yes      | `now()`  | Last reconciliation update.                                         |

### Keys and uniqueness

- Primary key: `id`.
- Partial unique `organization_id` where status is `trialing`, `active`, or `past_due`: one current subscription per organization.
- Partial unique (`provider`, `provider_subscription_id`) where provider subscription ID is non-null.

### Foreign keys

- `organization_id` → `billing.account.organization_id`, `ON DELETE RESTRICT`.

### Checks

- `plan_version >= 1`.
- Period columns are both null, or both present with `current_period_end > current_period_start`.
- Provider and provider-subscription ID are both null or both present.

### Indexes

- (`organization_id`, `created_at DESC`) for subscription history.
- (`status`, `current_period_end`) for renewal/expiry reconciliation.
- The two partial unique indexes above.

## `billing.provider_event`

Durable idempotent inbox for payment-provider webhooks. HTTP receipt persists the event before asynchronous interpretation changes subscription state.

| Column                | PostgreSQL type | Required | Default   | Description                                         |
| --------------------- | --------------- | -------- | --------- | --------------------------------------------------- |
| `id`                  | `text`          | Yes      | UUIDv7    | Internal event identifier.                          |
| `provider`            | `text`          | Yes      | —         | Payment provider.                                   |
| `provider_event_id`   | `text`          | Yes      | —         | Provider's globally stable event ID.                |
| `type`                | `text`          | Yes      | —         | Provider event type.                                |
| `livemode`            | `boolean`       | Yes      | —         | Separates production and test provider events.      |
| `data`                | `jsonb`         | Yes      | —         | Verified provider event data needed for processing. |
| `status`              | `text`          | Yes      | `pending` | Processing lifecycle state.                         |
| `attempts`            | `integer`       | Yes      | `0`       | Processing attempts.                                |
| `provider_created_at` | `timestamptz`   | Yes      | —         | Provider event creation time.                       |
| `processed_at`        | `timestamptz`   | No       | `NULL`    | Successful processing time.                         |
| `last_error`          | `text`          | No       | `NULL`    | Last bounded diagnostic message.                    |
| `created_at`          | `timestamptz`   | Yes      | `now()`   | Local receipt time.                                 |
| `updated_at`          | `timestamptz`   | Yes      | `now()`   | Last processing update.                             |

### Keys and uniqueness

- Primary key: `id`.
- Unique (`provider`, `provider_event_id`) makes webhook retries idempotent.

### Foreign keys

- None; provider events may arrive before local customer/subscription resolution succeeds.

### Checks

- `attempts >= 0`.

### Indexes

- (`status`, `created_at`) for the event worker.

## Usage source of truth

Current execution and signature usage is counted from successful domain operation tables over the effective billing window. Resource-count quotas are counted from active domain records. The subscription row selects a plan/version; plan definitions convert that selection into limits. A provider invoice is not the source of product authorization.

## Pending before production

- Implement and document a real payment-provider adapter and signature-verified webhook endpoint.
- Define immutable usage-ledger requirements before enabling overage billing; aggregate queries are suitable for quotas but may be insufficient for invoice-grade dispute evidence.
- Define proration, trial, grace-period, delinquency, and cancellation semantics.
- Add webhook dead-letter handling and reconciliation against provider state.
- Specify plan-version migration behavior for existing customers.
