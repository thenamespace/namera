# Executions

An execution submits one complete EVM call batch through one granted session key
and one ERC-4337 smart account. Preparation and simulation happen before policy
reservation; state and billing capacity are reserved transactionally before the
local session signer signs.

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

`POST /executions/prepare` and `POST /executions/complete` now implement these
contracts for granted API-key and CLI actors. The old single-call execution endpoint has been removed. The SDK and CLI
use prepare/complete with local signing.
No routine execution falls back to the wallet owner's signing key.

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

  Client->>App: prepare: wallet + session + chain + calls + sponsor + idempotency key
  App->>App: hash request and resolve prior actor/key attempt
  App->>EVM: reconstruct account, prepare UserOperation, estimate and simulate calls
  App->>App: resolve exact active grant and installed onchain session
  App->>Tx: lock wallet/grant and policy state; reserve budgets; persist unsigned preparation
  App-->>Client: exact preparation + signer ID + hash + expiry
  Client->>Client: validate preparation and sign locally
  Client->>App: complete: submission ID + signature
  App->>EVM: verify prepared invariants and local session signature
  App->>Tx: recheck authority/expiry; persist signed envelope once + audit
  App-->>Client: prepared (queued)
  App->>Bundler: worker submits exact signed operation
  App->>Tx: mark submitted + audit
  App->>Bundler: worker polls receipt
  alt successful receipt
    App->>Tx: settle policies + execution + billing + audit + in-app notification
    Client->>App: poll confirmed execution
  else pending or uncertain transport
    Client->>App: poll submitted operation
  else definitive failure
    App->>Tx: release reservations + mark failed + audit
    Client->>App: poll failed operation
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

Preparation is unique by organization, actor and idempotency key. Repeating the
same request returns the stored preparation while it remains usable; changing
its normalized request returns `IDEMPOTENCY_CONFLICT`. Duplicate preparation
does not reserve capacity or append audit events again. Completion conditionally
accepts one signature; later retries return the durable outcome without signing
or reserving again. Clients must poll an accepted attempt instead of starting a
new one after an uncertain response.

The application canonicalizes an omitted `sponsor` value to `true` before
hashing, so an automatic retry that explicitly serializes the default remains
the same logical request.

## Signing invariants

Before accepting a session signature, the EVM adapter verifies that account, EntryPoint, calls,
nonce, gas, fee, and sponsorship mode match the prepared policy context. Submission
verifies canonical and returned UserOperation hashes. Provider rejection is
distinguished from an uncertain transport outcome so uncertain submissions are
not incorrectly released.

## Reconciliation

A preparation expires at the earliest of five minutes, the onchain session's
expiry, or an API time-window policy's expiry. Acceptance rechecks the live
grant, session, wallet and signer under the wallet/grant locks and conditionally
updates the unsigned row before its deadline. Its prepared JSON is immutable;
only the verified signed envelope is attached. Preparation and acceptance audit
events share their respective transactions.

A scoped worker claims expired unsigned rows and due prepared/submitted rows with leases and bounded
concurrency. It recovers prepared submissions, polls status/receipt, and invokes
the same idempotent submit/settle/release lifecycle as the request. Settlement
locks the submission first, preventing the worker and HTTP request from
finalizing twice. Unsigned expiry marks the attempt failed and releases its
policy and billing reservations. Signed attempts remain recoverable after the
client signing deadline; that deadline does not authorize releasing an uncertain
onchain operation's capacity.

If a submission response is lost but the provider reports an included failure
(`reverted` or `failed`), recovery marks the attempt submitted and polls its
receipt instead of repeatedly submitting it. The failed receipt releases policy
and execution capacity while settling actual sponsored gas. HTTP regressions
cover both status variants and assert zero remaining billing reservations.
Lost-response recovery also covers a valid successful `included` receipt:
it confirms once, consumes one execution unit plus actual sponsored gas, and
writes one confirmation audit event. These tests substitute provider responses;
they verify the durable workflow, not live bundler availability.

Receipt recovery binds chain, UserOperation hash, sender, nonce and EntryPoint
to the stored signed envelope before settlement or release. A mismatch preserves
the submitted state and reservations and schedules another lookup; unrelated
provider evidence cannot finalize an attempt.

A different hash in the submission response is also an uncertain outcome, not
proof of rejection. Recovery retains holds when the canonical hash is initially
not found and keeps looking up that canonical hash. The HTTP regression covers
this visibility delay and a later matching receipt settling billing exactly once.

Each broadcast is preceded by a leased durable attempt marker. Only a first
attempt's validation rejection can be combined with an absent provider status to
release holds. Once an earlier attempt may have reached the bundler, a later send
rejection is insufficient; recovery retains holds until status/receipt evidence
resolves that canonical operation. The regression also covers rejection of a
retry between the lost first response and eventual receipt visibility.

Automatic broadcasts stop 24 hours after the submission was created. Recovery
then performs read-only receipt/status checks every five minutes and emits
`execution.reconciliation.unresolved` with the submission ID and a fixed reason.
The reconciliation counter uses `result=unresolved`; it contains no tenant IDs.
An eventual matching receipt still follows the submitted/settled transitions.
Age alone never marks an operation failed or releases its holds: the operation
may already have reached the chain. This is a bound on broadcasting and polling
frequency, not proof of a terminal outcome.

For an unresolved warning, inspect the recorded canonical UserOperation hash
against the configured chain/EntryPoint and provider. Restore provider access
and allow receipt reconciliation to finish. Do not clear billing reservations,
replace the signed envelope, or tell a client to create a new attempt solely
because a provider returns `not_found`. Manual force-release is deliberately
not exposed without authoritative non-execution evidence.

The PostgreSQL HTTP integration suite runs eight concurrent reconciliation passes
for submission and again for receipt settlement. Two queued operations produce
exactly two confirmations, one native-spend total, the expected execution/gas
usage and no remaining holds. A separate PostgreSQL regression abandons a claimed
prepared or submitted row, advances to lease expiry, and verifies replacement
claiming, rejection of stale terminal/release writes, and one final confirmation
with correct billing. This simulates loss of the worker at the durable claim
boundary. A separate regression interrupts the actual reconciliation fiber just
after the provider substitute accepts submission, before the submitted-state
write. This passes against both migrated PGlite and PostgreSQL. The signed
envelope and active billing holds survive, another worker
cannot claim before lease expiry, and takeover confirms once with one submitted
audit, one confirmation audit, and exactly one execution/gas settlement. This
injects Effect interruption, not an OS process kill or live bundler crash.

## Simulation

`POST /executions/simulate` requires wallet, chain, calls and an explicit
`sessionKeyId`. It resolves the same active grant and installed local signer as
execution, then runs shared public-only preparation and API policy preview.
It returns call outcomes and either approval for that session or its first
policy ID/denial code. It does not
insert submissions, reserve state, bill usage, audit, notify, or sign.

## Reads

- Submission status lets a machine actor poll only its own attempt.
- Confirmed history is newest-first with stable cursor pagination and a compact
  projection: execution identity, chain/transaction/date, compact wallet and
  session-key identity, and actor type.
- History accepts optional wallet and session-key scopes. Repository queries
  apply these together with organization and optional machine-actor grants,
  including when validating a pagination cursor.
- Detail reads expand typed receipt/calls plus a safe discriminated actor:
  member, API key, or OAuth authorization/client.
- User actors with `execution:read` see organization history. Machine actors
  (CLI, MCP, and API keys) see all confirmed executions performed by currently
  granted active session keys, regardless of the original submitting actor.
  Revoked historical grants still identify the execution's key; a separate
  current, non-revoked grant authorizes the reader. List, detail, and cursor
  lookup enforce this in SQL within the same organization. Revoking the reader's
  grant or session key removes history access immediately. Submission polling
  and completion remain restricted to the creating actor. Existing OAuth read
  scopes remain required.
- HTTP regressions cover a new CLI authorization reading prior API-key history,
  revocation of the original credential without losing shared history, current
  grant removal, ungranted keys, cross-organization denial, shared pagination,
  and unchanged submission ownership. These reads do not mutate state or emit
  audit events.

## Pending

- Migrate SDK/CLI execution and local MCP to installed session
  authority; complete the dashboard's local signer export/installation flow.
- Finish detached message/typed-data signing and its client integration.
- Validate self-funded Modular Account V2 execution against live Alchemy
  Rundler on every supported mainnet and testnet.
- Add product guidance for funding smart accounts before unsponsored execution.
- Add stale-submission/reservation age alerts and an operator recovery view.
