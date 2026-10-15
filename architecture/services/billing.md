# Billing and allowances

Billing is organization-scoped. The active product is Free v2; paid checkout,
subscription changes, invoicing, and provider webhook processing are not exposed.
Provider-oriented tables do not imply an active paid-billing integration.

## Current allowance

| Resource or meter             | Free allowance |
| ----------------------------- | -------------- |
| Owned organizations per user  | 3              |
| Members per organization      | 5              |
| Local/passkey wallets         | 10             |
| 1Claw wallets                 | 3              |
| Local session keys            | 100            |
| 1Claw session keys            | 5              |
| Mainnet executions per period | 100            |
| Testnet executions per period | 500            |
| Signatures per period         | 1,000          |
| Sponsored gas per period      | USD 3          |

Periods begin at the organization's creation instant and recur on its monthly
anniversary. Each period snapshots its plan version and meter definitions.
Resource limits use domain-row counts; operation meters use reservations and an
append-only usage ledger. Gas amounts are integer micro-USD, not floating point.

## Admission and settlement

Preparation creates the operation and its billing holds atomically. Reservations
are unique by period, meter, source type, and source ID. Opening a review can
therefore reserve allowance before the user confirms. Cancellation releases only
eligible unsigned preparations under the operation lock; it cannot release a
signed or potentially broadcast operation's hold.

Admission tests consumed plus reserved usage against the meter limit. Concurrent
requests use conditional balance updates. Successful settlement removes the hold
and records actual usage once. Definitive failure releases it. Pending receipts
and uncertain broadcasts are not failures and retain their holds.

Sponsored mainnet operations reserve gas separately from operation count. Receipt
confirmation and provider billing are separate: confirmation can activate a session
or finish an execution before Alchemy's cost is available. Cost reconciliation
binds the provider lookup to the signed operation's receipt evidence and records
the confirmed total USD. Missing cost retains the hold for retry.

If actual sponsored cost exceeds the reservation, Namera records the full cost
and absorbs the overrun. The balance may exceed the gas allowance; no extra Free
plan charge is created. Further sponsorship is denied, while self-funded work
can continue within the remaining operation limits and account balance checks.

## Maintenance

The billing worker rolls periods forward, resolves recoverable reservations,
retries sponsorship costs, and repairs balance projections from ledger totals
and active holds. It skips busy operation locks to avoid lock-order deadlocks.
Expiry alone never releases an owner operation or an unresolved transaction.

## Source

- [Plan definitions](../../packages/application/src/billing/data.ts)
- [Metering and maintenance](../../packages/application/src/billing/)
- [Billing tables](../data/billing.md)
