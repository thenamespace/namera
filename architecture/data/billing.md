# Billing tables

The `billing` schema separates plan state, admission projections, reservations,
and recorded usage. Integer amounts use `bigint`; units and meter versions are
stored with the rows that use them.

| Table               | Purpose and important constraints                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account`           | One row per organization; provider/customer fields are both present or both absent. Also serves as the resource-admission lock.                                       |
| `subscription`      | Versioned plan state; at most one trialing, active, or past-due subscription per organization. Provider identifiers are paired.                                       |
| `period`            | Plan/version snapshot and time window. One open period per organization; unique subscription/window and ordered start/end.                                            |
| `meter_balance`     | Primary key `(period_id, meter_key)`; included, hard-limit, consumed and reserved amounts. Nonnegative values; gas sponsorship alone may settle above its hard limit. |
| `usage_reservation` | One source hold per period/meter/source type/source ID. Active, settled, released and expired states have consistent terminal timestamps.                             |
| `usage_event`       | Append-only positive debit/credit amount. Unique organization idempotency key and one event per reservation. Credits reference the event they reverse.                |
| `subscription_item` | Provider component mapping, unique active subscription/component. Licensed items have quantity; metered items do not.                                                 |
| `usage_delivery`    | Provider-reporting outbox shape; unique event/provider/destination and provider idempotency key.                                                                      |
| `provider_event`    | Provider-webhook inbox shape, unique provider/event ID.                                                                                                               |

Period, reservation, ledger, and subscription references include organization
scope. A settlement event references the reservation's organization, period, and
meter together, preventing cross-meter or cross-tenant settlement.

The live Free workflow uses account, subscription, period, balance, reservation,
and usage-event tables. Provider inbox/outbox and subscription-item persistence
exist without a paid-billing delivery integration.

Balances are projections: repair locks each balance and recomputes consumed usage
from ledger debits/credits and reserved usage from active holds. It does not infer
transaction failure or delete an unresolved operation.

Source: [schema](../../packages/database/src/schema/billing/),
[billing workflows](../../packages/application/src/billing/).
