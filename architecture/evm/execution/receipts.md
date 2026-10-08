# Receipts and reconciliation

Receipt operations normalize Alchemy Rundler results into protocol models and verify the returned UserOperation hash. Application reconciliation turns uncertain prepared/submitted rows into confirmed executions or safely released failures.

## Adapter receipt operations

| Operation        | Behavior                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `getReceipt`     | Return `Option.none` only for recognized not-found; map other failures to `RECEIPT_LOOKUP_FAILED`. |
| `getStatus`      | Normalize Rundler unknown, pending, bundled, preconfirmed, and mined status.                       |
| `waitForReceipt` | Bound timeout to 1–120,000 ms (default 30,000); timeout returns `Option.none`.                     |

Normalized receipt includes chain ID, UserOperation/transaction/block hashes,
block number, sender, nonce, EntryPoint, optional provider-reported paymaster,
actual gas cost/used, success, and optional failure reason. BSO receipts normally
report no paymaster; sponsorship is determined from the persisted signed
execution envelope rather than receipt paymaster presence.

`isReceiptForEvmExecution` additionally compares chain, sender, nonce and
EntryPoint with a stored signed envelope. Session-key owner-operation and ordinary
execution recovery use this guard before committing policy or billing transitions. A failed
receipt may still match the operation; success controls the resulting transition,
not the identity check. Mismatched receipts defer recovery without releasing or
settling reservations, even if the provider also reports rejection. The ordinary
execution HTTP suite covers both successful and failed mismatched receipts.

## Settlement transaction

For a successful receipt, application settlement locks the submission first, verifies any reconciliation lease, locks policy states in deterministic order, applies handler settlement, marks reservations settled, inserts one final execution, marks submission confirmed, writes `execution.confirmed` audit, and creates permission-filtered in-app notifications—all in one transaction. Execution confirmations do not enqueue email jobs.

If already confirmed, settlement returns the existing execution. If failed or lease ownership was lost, it does nothing.

## Release transaction

For signing, definitive submission, or failed receipt, release locks the submission, verifies terminal/lease state, loads operation reservations, locks matching states, applies handler release, marks reservations released, marks submission failed, and writes `execution.failed` with a bounded stage.

## Reconciliation worker

Current policy:

| Setting                |      Value |
| ---------------------- | ---------: |
| Batch size             |         20 |
| Concurrency            |          5 |
| Lease duration         |  2 minutes |
| Retry delay            | 15 seconds |
| Broadcast lifetime     |   24 hours |
| Unresolved retry delay |  5 minutes |

```mermaid
flowchart TD
  Claim[Claim due prepared/submitted rows with lease] --> Data{Grant, session key, wallet, signed data available?}
  Data -->|No recoverable data| Release[Release policies and fail]
  Data -->|Transient relation issue| Retry[Release lease; schedule retry]
  Data -->|Yes| Status{Submission status}
  Status -->|prepared| Resubmit[Retry sendUserOperation]
  Resubmit --> Observe[Query status when needed]
  Observe -->|submitted/included/reverted/failed| Mark[Mark submitted; recover receipt]
  Observe -->|rejected| Release
  Observe -->|first attempt definitively rejected and not observed| Release
  Observe -->|unknown/transient| Retry
  Status -->|submitted| Receipt[Get receipt]
  Receipt -->|successful| Settle[Settle and confirm]
  Receipt -->|matching failed receipt| Release
  Receipt -->|not found/transient| Retry
```

The submission row is locked before policy state for both settle and release. Deterministic state-scope ordering prevents deadlocks when operations touch multiple budgets.

## User-visible status

Detached completion returns the queued `prepared` operation. Clients poll the
submission status rather than sending a new logical operation. The worker
advances it to submitted and then confirmed or failed. After 24 hours it stops
rebroadcasting an uncertain operation but continues status/receipt recovery at
five-minute intervals. Uncertainty alone never releases the reserved budget.
