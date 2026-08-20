# Executions

An execution submits one complete EVM call batch through one granted session key
and one ERC-4337 smart account. Preparation and simulation happen before policy
reservation; state and billing capacity are reserved transactionally before the
wallet owner signs.

## Tables

### `core.execution_submission`

Mutable operation ledger containing organization, actor, selected grant,
namespace, actor-scoped idempotency key, request hash, policy hash, lifecycle
status, namespace-discriminated requested calls and signed operation, recovery
lease, reconcile time, and submitted/confirmed/failed timestamps.

Key constraints and indexes:

- unique `(organization_id, actor_id, idempotency_key)`;
- composite grant/actor/organization ownership;
- organization and actor newest-first lists;
- status/next-reconcile/lease indexes for workers;
- one stable `(id, grant, organization)` identity for the confirmed record.

### `core.execution`

Append-only confirmed record containing execution ID, submission, organization,
grant, namespace, complete typed receipt/calls, and creation time. Submission is
unique, and composite foreign keys prove the execution uses the same grant and
organization. Cursor indexes serve organization and grant history.

The mutable submission makes retries and reconciliation explicit. The immutable
execution is the billable, user-visible confirmed ledger.

## Execute flow

```mermaid
sequenceDiagram
  participant Client
  participant App as Execution application
  participant EVM
  participant Tx as PostgreSQL transaction
  participant Bundler

  Client->>App: wallet + chain + calls + internal idempotency key
  App->>App: hash request and resolve prior actor/key attempt
  App->>EVM: reconstruct account, prepare UserOperation, estimate and simulate calls
  App->>App: resolve active granted session-key candidates
  loop deterministic candidate order
    App->>EVM: evaluate stateless policies
    App->>Tx: lock billing + policy state; reserve budgets; insert submission/reservations
  end
  App->>EVM: verify prepared invariants and sign exact UserOperation
  App->>Tx: persist signed prepared operation
  App->>Bundler: submit
  App->>Tx: mark submitted + audit
  App->>Bundler: bounded receipt wait
  alt successful receipt
    App->>Tx: settle policies + execution + billing + audit + notification/email
    App-->>Client: confirmed execution
  else pending or uncertain transport
    App-->>Client: submitted operation
  else definitive failure
    App->>Tx: release reservations + mark failed + audit
    App-->>Client: typed failure
  end
```

One candidate must authorize the entire batch. Namera never combines permissions
from multiple session keys. Billing enforcement and stateful reservations occur
inside the same transaction. Parallel requests cannot consume the same final
capacity.

## Idempotency

SDK, CLI, and MCP generate an internal UUIDv7 key and reuse it across transient
retries. End users do not provide the key. A repeated actor/key with the same
request hash returns current failed/submitted/confirmed state; a different hash
returns `IDEMPOTENCY_CONFLICT`.

## Signing invariants

Before owner signing, the EVM adapter verifies that account, EntryPoint, calls,
nonce, gas, fee, and paymaster data match the prepared policy context. Submission
verifies canonical and returned UserOperation hashes. Provider rejection is
distinguished from an uncertain transport outcome so uncertain submissions are
not incorrectly released.

## Reconciliation

A scoped worker claims due prepared/submitted rows with leases and bounded
concurrency. It recovers prepared submissions, polls status/receipt, and invokes
the same idempotent submit/settle/release lifecycle as the request. Settlement
locks the submission first, preventing the worker and HTTP request from
finalizing twice.

## Simulation

`POST /executions/simulate` performs preparation, call simulation, and policy
preview for every eligible active grant. It returns call outcomes and either the
selected session key or each candidate's first policy ID/denial code. It does not
insert submissions, reserve state, bill usage, audit, notify, or sign.

## Reads

- Submission status lets a machine actor poll only its own attempt.
- Confirmed history is newest-first with stable cursor pagination and a compact
  projection: execution identity, chain/transaction/date, compact wallet and
  session-key identity, and actor type.
- Detail reads expand typed receipt/calls plus a safe discriminated actor:
  member, API key, or OAuth authorization/client.
- User actors with `execution:read` see organization history. Machine actors see
  only their own grant-scoped operations.

## Pending

- Add wallet- and session-key-scoped history query parameters or routes.
- Add stale-submission/reservation age alerts and an operator recovery view.
