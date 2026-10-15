# Operation reconciliation

Workers recover persisted signed operations independently of the browser request.
They claim due rows with a lease, query the chain adapter, apply a conditional
state transition and schedule another attempt when the result is unresolved.
Lease tokens prevent a stale worker from completing another worker's claim.

## Evidence and safety

The adapter uses `eth_getUserOperationReceipt` and
`eth_getUserOperationByHash`. A null lookup means unobserved, not rejected.
A lookup may omit `transactionHash` or return null while pending. Neither case
is a decoding failure or evidence that the transaction failed.

Pausing a chain blocks new operation admission, not receipt or status reads.
Adapter tests exercise pending and mined responses while admission is disabled;
their transport accepts only the corresponding read RPC, never submission.

A receipt must match the persisted signed envelope's chain, hash, sender, nonce
and EntryPoint. Only then can its success flag establish execution outcome.
An included revert can still incur gas charges.

A worker can perform the first send only when the durable marker explicitly
says no broadcast has been attempted. It records the attempt before contacting
the bundler. Timeout, ambiguous RPC failure and absent status after a send do
not authorize rebroadcast. A definitive rejection of a known first attempt can
terminate it after the lookup checks; uncertainty retains the operation and hold.

## Scheduling

The three workers currently use different schedules; backoff is not a shared
global policy.

| Worker                 | Concurrent claims | Lease / attempt timeout | Unresolved scheduling                                                    |
| ---------------------- | ----------------- | ----------------------- | ------------------------------------------------------------------------ |
| Wallet transactions    | 4                 | 120s / 60s              | Pending: 15s doubling to 120s; errors: 30s doubling to 900s; ±20% jitter |
| Session install/remove | 4                 | 120s / 60s              | 15s, then 5 minutes after 24 hours                                       |
| Delegated executions   | 5                 | 120s / 60s              | 15s, then 5 minutes after 24 hours                                       |

Wallet progress resets its attempt progression. A successful lookup resets the
consecutive error count. Blocked wallet submissions and those aged 24 hours use
a minimum 15-minute base interval before jitter. Aging slows observation; it is
not a transaction failure deadline. Workers do not initiate a first broadcast
after the 24-hour window.

Unsigned approvals expire separately. Their reservations can be released because
no signed submission exists. Signed and submitted operations keep their holds
until evidence permits settlement or rejection. Gas holds may outlive transaction
confirmation while the billing worker obtains the provider charge.

## Diagnostics

Backlog count and oldest age are worker metrics. Wallet failure logs include the
operation ID, status, chain, attempt/error count and bounded error classification.
Provider causes are not serialized: they can contain credentials and signed data.
Operators should inspect persisted state and provider evidence, not delete an
operation or release its reservation merely to clear a warning.

## Code

- [Wallet worker](../../packages/application/src/wallet/transactions/reconcile.ts)
- [Wallet schedule](../../packages/application/src/wallet/transactions/reconciliation-policy.ts)
- [Session worker](../../packages/application/src/session-key/reconcile-operations.ts)
- [Execution worker](../../packages/application/src/execution/reconciliation.ts)
- [Receipt normalization](../../packages/evm/src/execution/receipt.ts)
- [Receipt binding](../../packages/evm/src/execution/receipt-binding.ts)
