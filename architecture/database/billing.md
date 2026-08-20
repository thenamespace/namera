# Billing tables

The `billing` schema stores organization billing identity, subscription and
period history, normalized meter state, immutable usage evidence, and payment
provider synchronization. Plan definitions, meter definitions, price mappings,
and entitlement behavior remain code-owned.

Source: [`packages/database/src/schema/billing`](../../packages/database/src/schema/billing).

## `billing.account`

One billing identity per organization. It exists for Free organizations and may
later bind to a provider customer.

| Column                 | Type          | Required | Default | Description                                 |
| ---------------------- | ------------- | -------- | ------- | ------------------------------------------- |
| `organization_id`      | `text`        | Yes      | —       | Primary key and owning organization.        |
| `provider`             | `text`        | No       | `NULL`  | Provider discriminator; currently `stripe`. |
| `provider_customer_id` | `text`        | No       | `NULL`  | Provider customer identifier.               |
| `billing_email`        | `text`        | No       | `NULL`  | Invoice/contact email.                      |
| `currency`             | `text`        | Yes      | `usd`   | Billing currency.                           |
| `created_at`           | `timestamptz` | Yes      | `now()` | Creation time.                              |
| `updated_at`           | `timestamptz` | Yes      | `now()` | Last profile/provider-link update.          |

### Integrity and access paths

- Primary key: `organization_id`.
- Foreign key: `organization_id` → `auth.organization.id`, `ON DELETE RESTRICT`.
- Partial unique (`provider`, `provider_customer_id`) where customer ID is set.
- Check: provider and provider customer ID are both null or both non-null.

## `billing.subscription`

Plan selection and lifecycle history. Providerless Free rows and provider-backed
paid/trial rows use one model.

| Column                     | Type          | Required | Default  | Description                       |
| -------------------------- | ------------- | -------- | -------- | --------------------------------- |
| `id`                       | `text`        | Yes      | UUIDv7   | Internal subscription ID.         |
| `organization_id`          | `text`        | Yes      | —        | Owning billing account.           |
| `provider`                 | `text`        | No       | `NULL`   | Payment provider.                 |
| `provider_subscription_id` | `text`        | No       | `NULL`   | Provider subscription ID.         |
| `plan`                     | `text`        | Yes      | `free`   | Code-owned plan key.              |
| `plan_version`             | `integer`     | Yes      | `1`      | Plan-definition version.          |
| `status`                   | `text`        | Yes      | `active` | Subscription lifecycle state.     |
| `current_period_start`     | `timestamptz` | No       | `NULL`   | Current entitlement window start. |
| `current_period_end`       | `timestamptz` | No       | `NULL`   | Current entitlement window end.   |
| `cancel_at_period_end`     | `boolean`     | Yes      | `false`  | Scheduled cancellation flag.      |
| `ended_at`                 | `timestamptz` | No       | `NULL`   | Terminal end time.                |
| `data`                     | `jsonb`       | Yes      | `{}`     | Versioned provider/plan metadata. |
| `created_at`               | `timestamptz` | Yes      | `now()`  | History-row creation time.        |
| `updated_at`               | `timestamptz` | Yes      | `now()`  | Last reconciliation update.       |

### Integrity and access paths

- Primary key: `id`.
- Unique (`id`, `organization_id`) supports tenant-safe composite references.
- Foreign key: `organization_id` → `billing.account.organization_id`, restrict.
- Partial unique `organization_id` for `trialing`, `active`, or `past_due` rows.
- Partial unique (`provider`, `provider_subscription_id`) when provider ID exists.
- Check: `plan_version >= 1`.
- Check: period timestamps are both null or form a valid increasing window.
- Check: provider and provider subscription ID are both null or both non-null.
- Index (`organization_id`, `created_at DESC`) serves history reads.
- Index (`status`, `current_period_end`) serves reconciliation/expiry work.

## `billing.subscription_item`

Maps independently priced Namera components to provider subscription items.
Free subscriptions can have no rows.

| Column                          | Type          | Required | Default  | Description                                |
| ------------------------------- | ------------- | -------- | -------- | ------------------------------------------ |
| `id`                            | `text`        | Yes      | UUIDv7   | Internal component mapping ID.             |
| `organization_id`               | `text`        | Yes      | —        | Tenant guard.                              |
| `subscription_id`               | `text`        | Yes      | —        | Owning local subscription.                 |
| `component_key`                 | `text`        | Yes      | —        | Code-owned priced component key.           |
| `billing_mode`                  | `text`        | Yes      | —        | `licensed` or `metered`.                   |
| `provider`                      | `text`        | Yes      | —        | Payment provider.                          |
| `provider_subscription_item_id` | `text`        | Yes      | —        | Provider subscription item ID.             |
| `provider_price_id`             | `text`        | Yes      | —        | Provider price ID.                         |
| `quantity`                      | `bigint`      | No       | `NULL`   | Licensed quantity; null for metered items. |
| `status`                        | `text`        | Yes      | `active` | `active` or `removed`.                     |
| `removed_at`                    | `timestamptz` | No       | `NULL`   | Provider component removal time.           |
| `created_at`                    | `timestamptz` | Yes      | `now()`  | Creation time.                             |
| `updated_at`                    | `timestamptz` | Yes      | `now()`  | Last reconciliation update.                |

### Integrity and access paths

- Primary key: `id`.
- Composite tenant FK (`subscription_id`, `organization_id`) → subscription.
- Unique (`provider`, `provider_subscription_item_id`).
- Partial unique (`subscription_id`, `component_key`) for active rows.
- Check: licensed rows have non-negative quantity; metered rows have null quantity.
- Check: active rows have null `removed_at`; removed rows have it set.
- Index (`organization_id`, `component_key`) serves component lookup.

## `billing.period`

An immutable usage window and plan-version snapshot. Every active subscription,
including Free, will use periods after application metering is wired.

| Column            | Type          | Required | Default | Description                  |
| ----------------- | ------------- | -------- | ------- | ---------------------------- |
| `id`              | `text`        | Yes      | UUIDv7  | Internal period ID.          |
| `organization_id` | `text`        | Yes      | —       | Owning organization.         |
| `subscription_id` | `text`        | Yes      | —       | Effective subscription.      |
| `plan`            | `text`        | Yes      | —       | Snapshotted plan key.        |
| `plan_version`    | `integer`     | Yes      | —       | Snapshotted plan version.    |
| `starts_at`       | `timestamptz` | Yes      | —       | Inclusive period start.      |
| `ends_at`         | `timestamptz` | Yes      | —       | Exclusive period end.        |
| `status`          | `text`        | Yes      | `open`  | `open` or `closed`.          |
| `closed_at`       | `timestamptz` | No       | `NULL`  | Local close-transition time. |
| `created_at`      | `timestamptz` | Yes      | `now()` | Creation time.               |
| `updated_at`      | `timestamptz` | Yes      | `now()` | Last lifecycle update.       |

### Integrity and access paths

- Primary key: `id`; unique (`id`, `organization_id`) supports child FKs.
- Composite tenant FK (`subscription_id`, `organization_id`) → subscription.
- Unique (`subscription_id`, `starts_at`, `ends_at`) prevents duplicate windows.
- Partial unique `organization_id` for open rows enforces one open period.
- Checks: version at least 1, end after start, and status/`closed_at` consistency.
- Index (`organization_id`, `starts_at DESC`) serves period history.
- Index (`status`, `ends_at`) serves rollover claims.

## `billing.meter_balance`

Admission-control projection for one period and meter. It is fast mutable state;
the immutable usage ledger remains the historical source of truth.

| Column              | Type          | Required | Default | Description                             |
| ------------------- | ------------- | -------- | ------- | --------------------------------------- |
| `organization_id`   | `text`        | Yes      | —       | Tenant guard.                           |
| `period_id`         | `text`        | Yes      | —       | Billing period.                         |
| `meter_key`         | `text`        | Yes      | —       | Code-owned meter key.                   |
| `meter_version`     | `integer`     | Yes      | —       | Measurement semantics version.          |
| `unit`              | `text`        | Yes      | —       | `operation` or `micro-usd`.             |
| `included_amount`   | `bigint`      | Yes      | —       | Included period allowance.              |
| `hard_limit_amount` | `bigint`      | No       | `NULL`  | Admission ceiling; null allows overage. |
| `consumed_amount`   | `bigint`      | Yes      | `0`     | Settled debit-minus-credit projection.  |
| `reserved_amount`   | `bigint`      | Yes      | `0`     | Capacity held by active reservations.   |
| `created_at`        | `timestamptz` | Yes      | `now()` | Initialization time.                    |
| `updated_at`        | `timestamptz` | Yes      | `now()` | Last reservation/settlement update.     |

### Integrity and access paths

- Composite primary key: (`period_id`, `meter_key`).
- Composite tenant FK (`period_id`, `organization_id`) → period.
- Checks: version at least 1 and all stored amounts non-negative.
- Check: hard limit is null or at least the included amount and current
  consumed-plus-reserved amount.
- Index (`organization_id`, `period_id`) loads all balances for a period.

## `billing.usage_reservation`

Temporary capacity ownership for in-flight billable work. It prevents concurrent
operations from collectively exceeding a hard limit.

| Column            | Type          | Required | Default  | Description                      |
| ----------------- | ------------- | -------- | -------- | -------------------------------- |
| `id`              | `text`        | Yes      | UUIDv7   | Reservation ID.                  |
| `organization_id` | `text`        | Yes      | —        | Tenant guard.                    |
| `period_id`       | `text`        | Yes      | —        | Period whose capacity is held.   |
| `meter_key`       | `text`        | Yes      | —        | Reserved meter.                  |
| `meter_version`   | `integer`     | Yes      | —        | Meter version at authorization.  |
| `unit`            | `text`        | Yes      | —        | Quantity unit.                   |
| `amount`          | `bigint`      | Yes      | —        | Positive reserved quantity.      |
| `source_type`     | `text`        | Yes      | —        | Domain source discriminator.     |
| `source_id`       | `text`        | Yes      | —        | Domain operation ID.             |
| `status`          | `text`        | Yes      | `active` | Active/settled/released/expired. |
| `expires_at`      | `timestamptz` | Yes      | —        | Recovery expiry time.            |
| `settled_at`      | `timestamptz` | No       | `NULL`   | Successful settlement time.      |
| `released_at`     | `timestamptz` | No       | `NULL`   | Release or expiration time.      |
| `created_at`      | `timestamptz` | Yes      | `now()`  | Creation time.                   |
| `updated_at`      | `timestamptz` | Yes      | `now()`  | Last lifecycle update.           |

### Integrity and access paths

- Primary key: `id`; tenant and settlement-scope composite uniques support FKs.
- Unique (`period_id`, `meter_key`, `source_type`, `source_id`) prevents duplicate
  reservation for the same operation and meter.
- Composite tenant FK (`period_id`, `organization_id`) → period.
- Source is deliberately generic; application code creates it with the domain
  operation in one transaction rather than using polymorphic SQL foreign keys.
- Checks: version at least 1, amount positive, and terminal timestamps consistent
  with status.
- Index (`organization_id`, `period_id`, `status`) serves period usage work.
- Index (`status`, `expires_at`) serves the expiry worker.

## `billing.usage_event`

Append-only invoice-grade ledger. Debits add usage; credits correct an earlier
debit. There is no `updated_at` because historical evidence is immutable.

| Column                    | Type          | Required | Default | Description                                 |
| ------------------------- | ------------- | -------- | ------- | ------------------------------------------- |
| `id`                      | `text`        | Yes      | UUIDv7  | Usage event ID.                             |
| `organization_id`         | `text`        | Yes      | —       | Tenant guard.                               |
| `period_id`               | `text`        | Yes      | —       | Receiving period.                           |
| `meter_key`               | `text`        | Yes      | —       | Code-owned meter key.                       |
| `meter_version`           | `integer`     | Yes      | —       | Measurement semantics version.              |
| `unit`                    | `text`        | Yes      | —       | `operation` or `micro-usd`.                 |
| `amount`                  | `bigint`      | Yes      | —       | Positive quantity; direction carries sign.  |
| `direction`               | `text`        | Yes      | —       | `debit` or `credit`.                        |
| `source_type`             | `text`        | Yes      | —       | Domain source discriminator.                |
| `source_id`               | `text`        | Yes      | —       | Domain operation ID.                        |
| `reservation_id`          | `text`        | No       | `NULL`  | Consumed reservation, when applicable.      |
| `idempotency_key`         | `text`        | Yes      | —       | Permanent settlement identity.              |
| `data`                    | `jsonb`       | Yes      | `{}`    | Versioned meter-owned measurement evidence. |
| `reverses_usage_event_id` | `text`        | No       | `NULL`  | Debit corrected by a credit.                |
| `occurred_at`             | `timestamptz` | Yes      | —       | When usage occurred.                        |
| `created_at`              | `timestamptz` | Yes      | `now()` | Local persistence time.                     |

### Integrity and access paths

- Primary key: `id`; unique (`id`, `organization_id`) supports tenant FKs.
- Unique (`organization_id`, `idempotency_key`) makes retries safe.
- Partial unique non-null `reservation_id` allows one settlement per reservation.
- Partial unique debit source scope allows one debit per source/meter/period.
- Composite tenant FK (`period_id`, `organization_id`) → period.
- Composite reservation FK also requires matching tenant, period, and meter.
- Composite self-FK keeps reversals in the same organization.
- Checks: version at least 1, positive amount, debit/credit reversal shape, and
  no self-reversal.
- Application settlement additionally prevents over-credit and ensures the
  original event has the same meter/unit and is a debit.
- Index (`organization_id`, `period_id`, `meter_key`, `occurred_at DESC`) serves
  history/reconciliation; (`source_type`, `source_id`) traces domain operations.

## `billing.usage_delivery`

Durable outbound provider-delivery work. It separates local settlement from
Stripe availability and records retries without mutating usage evidence.

| Column                 | Type          | Required | Default   | Description                           |
| ---------------------- | ------------- | -------- | --------- | ------------------------------------- |
| `id`                   | `text`        | Yes      | UUIDv7    | Delivery ID.                          |
| `organization_id`      | `text`        | Yes      | —         | Tenant guard.                         |
| `usage_event_id`       | `text`        | Yes      | —         | Immutable local usage event.          |
| `provider`             | `text`        | Yes      | —         | Target provider.                      |
| `destination`          | `text`        | Yes      | —         | Provider meter/item destination.      |
| `provider_customer_id` | `text`        | Yes      | —         | Customer snapshot for reconciliation. |
| `idempotency_key`      | `text`        | Yes      | —         | Provider request identity.            |
| `provider_usage_id`    | `text`        | No       | `NULL`    | Provider acknowledgement ID.          |
| `status`               | `text`        | Yes      | `pending` | Pending/retrying/delivered/failed.    |
| `attempts`             | `integer`     | Yes      | `0`       | Delivery attempts.                    |
| `next_attempt_at`      | `timestamptz` | No       | `NULL`    | Earliest retry claim time.            |
| `last_error`           | `text`        | No       | `NULL`    | Last bounded diagnostic message.      |
| `delivered_at`         | `timestamptz` | No       | `NULL`    | Provider acknowledgement time.        |
| `created_at`           | `timestamptz` | Yes      | `now()`   | Enqueue time.                         |
| `updated_at`           | `timestamptz` | Yes      | `now()`   | Last worker transition time.          |

### Integrity and access paths

- Primary key: `id`.
- Composite tenant FK (`usage_event_id`, `organization_id`) → usage event.
- Unique (`usage_event_id`, `provider`, `destination`) prevents duplicate work.
- Unique (`provider`, `idempotency_key`) prevents provider key reuse.
- Checks: attempts non-negative; only delivered rows have `delivered_at`.
- Index (`status`, `next_attempt_at`) serves worker claims.
- Index (`organization_id`, `created_at DESC`) serves operations views.

## `billing.provider_event`

Durable idempotent inbox for verified payment-provider webhooks. It is inbound;
`usage_delivery` is outbound.

| Column                | Type          | Required | Default   | Description                               |
| --------------------- | ------------- | -------- | --------- | ----------------------------------------- |
| `id`                  | `text`        | Yes      | UUIDv7    | Internal inbox ID.                        |
| `provider`            | `text`        | Yes      | —         | Payment provider.                         |
| `provider_event_id`   | `text`        | Yes      | —         | Provider's stable event ID.               |
| `type`                | `text`        | Yes      | —         | Provider event type.                      |
| `livemode`            | `boolean`     | Yes      | —         | Provider production/test mode.            |
| `data`                | `jsonb`       | Yes      | —         | Verified event data needed by the worker. |
| `status`              | `text`        | Yes      | `pending` | Pending/processed/failed.                 |
| `attempts`            | `integer`     | Yes      | `0`       | Processing attempts.                      |
| `provider_created_at` | `timestamptz` | Yes      | —         | Provider event creation time.             |
| `processed_at`        | `timestamptz` | No       | `NULL`    | Successful processing time.               |
| `last_error`          | `text`        | No       | `NULL`    | Last bounded diagnostic message.          |
| `created_at`          | `timestamptz` | Yes      | `now()`   | Local receipt time.                       |
| `updated_at`          | `timestamptz` | Yes      | `now()`   | Last worker transition time.              |

### Integrity and access paths

- Primary key: `id`.
- No foreign key: provider events can precede local target resolution.
- Unique (`provider`, `provider_event_id`) makes webhook retries idempotent.
- Check: attempts non-negative.
- Index (`status`, `created_at`) serves worker claims.

## Retention and pending work

Billing history uses `ON DELETE RESTRICT`; product cleanup cannot cascade-delete
invoice evidence. Production retention should archive or anonymize eligible
contact/provider data without removing financial evidence.

Free v1 initializes these rows with every organization and uses the reservation,
ledger, balance, period, recovery, and reconciliation paths in production code.
Before paid plans, define provider data retention/dead-letter procedures and add
PostgreSQL stress tests for concurrent admission plus provider-specific tests for
corrections, webhook replay, and delivery retries.
