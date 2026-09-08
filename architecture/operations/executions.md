# Executions

An execution submits one complete EVM call batch through one granted session key
and one ERC-4337 smart account. Preparation and simulation happen before policy
reservation; state and billing capacity are reserved transactionally before the
wallet owner signs.

## Persistence and EVM internals

### Self-custody migration boundary

`PrepareExecutionRequest` and `CompleteExecutionRequest` define the new local
signing contract in protocol. Preparation selects one explicit `sessionKeyId`
alongside wallet, chain, calls and sponsorship. Its response identifies the
persisted submission, installation and signing key, and includes the exact
prepared operation plus its raw UserOperation hash for EIP-191 signing. Clients
must recompute that hash before asking the local signer to sign.

Completion carries only namespace, submission ID and the raw 65-byte secp256k1
signature. The server must load the immutable preparation, recheck authority and
expiry, verify the signature, then construct the account validation envelope.
It must not accept replacement operation fields from the client. Schema tests
cover wire quantities, required signer selection and signature-envelope shape;
cryptographic correctness is tested in the EVM adapter.

These contracts are not yet HTTP endpoints. The workflow below still describes
the legacy executor until persistence, application and route wiring are replaced.

The complete `core.execution_submission` and `core.execution` definitions are
in the [core database catalog](../database/core-wallets-operations.md). The
mutable submission makes retries/reconciliation explicit; the confirmed
execution is the user-visible successful fact. EVM preparation, integrity
checks, provider submission, receipt normalization, and worker decisions are
documented in the [EVM execution pipeline](../evm/execution/README.md).

## Execute flow

```mermaid
sequenceDiagram
  participant Client
  participant App as Execution application
  participant EVM
  participant Tx as PostgreSQL transaction
  participant Bundler

  Client->>App: wallet + chain + calls + optional sponsor + internal idempotency key
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

Gas sponsorship defaults to enabled and uses Alchemy Bundler Sponsored
Operations (BSO). An explicit `sponsor: false` submits a self-funded
UserOperation through regular Rundler without the BSO policy header. Both modes
reserve and settle one mainnet or testnet execution unit. Only a sponsored
mainnet operation reserves and settles the `gas-sponsorship` balance; testnet and
unsponsored mainnet operations never consume that balance.

## Idempotency

SDK, CLI, and MCP generate an internal UUIDv7 key and reuse it across transient
retries. End users do not provide the key. A repeated actor/key with the same
request hash returns current failed/submitted/confirmed state; a different hash
returns `IDEMPOTENCY_CONFLICT`.

The application canonicalizes an omitted `sponsor` value to `true` before
hashing, so an automatic retry that explicitly serializes the default remains
the same logical request.

## Signing invariants

Before owner signing, the EVM adapter verifies that account, EntryPoint, calls,
nonce, gas, fee, and sponsorship mode match the prepared policy context. Submission
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
- History accepts optional wallet and session-key scopes. Repository queries
  apply these together with organization and optional machine-actor ownership,
  including when validating a pagination cursor.
- Detail reads expand typed receipt/calls plus a safe discriminated actor:
  member, API key, or OAuth authorization/client.
- User actors with `execution:read` see organization history. Machine actors see
  only their own grant-scoped operations.

## Pending

- Validate self-funded Modular Account V2 execution against live Alchemy
  Rundler on every supported mainnet and testnet.
- Add product guidance for funding smart accounts before unsponsored execution.
- Add stale-submission/reservation age alerts and an operator recovery view.
