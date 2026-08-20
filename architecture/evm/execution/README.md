# EVM execution pipeline

An execution is one ERC-4337 call batch authorized in full by one active session-key grant. Namera never combines policies from multiple grants to synthesize authority the user did not create.

## Phases

| Phase                | Owner                                     | Durable effect                                                     |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| Resolve/prepare      | Application + EVM adapter                 | Provider simulations and EVM-owned billing envelope.               |
| Stateless evaluation | EVM policy service                        | None.                                                              |
| Reserve              | Application transaction + policy handlers | Billing check, submission, policy state changes, and reservations. |
| Sign                 | EVM adapter + wallet-key owner            | Prepared UserOperation is integrity-checked and signed.            |
| Submit               | EVM adapter                               | Bundler accepts or ambiguously observes UserOperation.             |
| Mark submitted       | Application transaction                   | Submission/reservations transition and audit event.                |
| Settle/release       | Application transaction                   | Policy accounting, final execution/failure, audit, notifications.  |
| Reconcile            | Background application operation          | Leased retry of prepared/submitted attempts.                       |

Details: [prepare](prepare.md), [sign/submit](sign-submit.md), [receipts/reconciliation](receipts.md), and [operation tables](../../database/core-wallets-operations.md).

## End-to-end sequence

```mermaid
sequenceDiagram
  participant Caller
  participant App as Execution application
  participant EVM as EVM adapter
  participant DB as PostgreSQL
  participant Bundler as Pimlico
  App->>DB: Resolve actor grants, wallet, key, active session-key candidates
  App->>EVM: Prepare account call batch
  EVM->>Bundler: Prepare/estimate UserOperation
  EVM->>EVM: simulateCalls with assets and transfers
  EVM-->>App: Prepared execution + policy context
  loop Candidates in deterministic order
    App->>EVM: Stateless policy evaluation
    alt candidate may authorize
      App->>DB: Transaction: reserve execution/gas meters; lock policy state
      App->>EVM: Plan stateful reservation
      App->>DB: Insert submission, state changes, reservations
    end
  end
  App->>EVM: Sign prepared UserOperation
  App->>DB: Mark prepared and persist signed execution
  App->>EVM: Submit to bundler
  EVM->>Bundler: eth_sendUserOperation
  App->>DB: Mark submission/reservations submitted + audit
  App->>EVM: Wait bounded time for receipt
  alt successful receipt
    App->>DB: Transaction: settle policies/billing, insert execution, confirm submission, audit, notifications
    App-->>Caller: confirmed execution + receipt
  else no receipt yet
    App-->>Caller: submitted + UserOperation hash
  else signing/definitive submission failure
    App->>DB: Transaction: release policies/billing, fail submission, audit
    App-->>Caller: execution failed
  else reverted receipt
    App->>DB: Transaction: release execution count, settle actual sponsored gas, fail submission, audit
    App-->>Caller: execution failed
  end
```

An ambiguous submission (`SUBMISSION_UNKNOWN`) is treated as potentially broadcast. It is marked submitted and reconciled; releasing policy or billing budget immediately could allow overspend if the network later includes it. A failed/reverted status without a receipt is also deferred because included failure consumes gas; only the receipt carries the authoritative actual cost.

## Idempotency

Clients generate one UUID idempotency key per logical call and reuse it only for automatic retries of that call. The application hashes the decoded request. A repeated actor/key:

- returns the prior confirmed/submitted response when request hash matches;
- returns `EXECUTION_FAILED` for a prior terminal failure;
- returns `IDEMPOTENCY_CONFLICT` when the same key carries different input.

The unique database key (`organization_id`, `actor_id`, `idempotency_key`) resolves races after an initial optimistic lookup.

## Simulation-only route

Simulation shares grant/wallet/account preparation and policy logic but does not create a submission, change state, or create reservations. It loads current committed states, supplies missing handler seeds, and calls the pure reservation planner as a preview. It returns call outcomes, asset changes, native transfers, and a candidate-specific policy decision.

## Pending before production

- Run concurrency tests across HTTP execute, retries, and reconciliation for the same submission.
- Define synchronous wait timeouts and client polling guidance.
- Add a durable reconciliation scheduler/worker deployment runbook.
- Validate Alchemy quote freshness and Pimlico production invoice variance; use
  provider-confirmed cost when that source becomes available.
