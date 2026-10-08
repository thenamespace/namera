# EVM execution pipeline

An execution is one ERC-4337 call batch authorized by one explicitly selected,
installed session key and active grant. Policies from multiple grants are never
combined. The owner passkey approves installation/removal; the local session
signer signs routine executions.

## Phases

| Phase          | Owner                    | Result                                                                                                         |
| -------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Prepare        | Application and EVM      | Resolve selected grant/installation; reconstruct public account, estimate UserOperation and simulate calls.    |
| Reserve        | Application transaction  | Lock authority and policy state; reserve billing and policy budgets; persist unsigned preparation with expiry. |
| Local sign     | SDK and client signer    | Validate preparation against local binding, calls and gas consent; sign the exact operation hash.              |
| Complete       | Application and EVM      | Verify signature/integrity, recheck authority and expiry, persist signed envelope once.                        |
| Broadcast      | Execution worker and EVM | Persist attempt marker, submit exact operation, record observed acceptance.                                    |
| Reconcile      | Leased execution worker  | Poll canonical status/receipt; retry uncertain outcomes with bounded concurrency.                              |
| Settle/release | Application transaction  | Update policy and billing ledgers, terminal operation, audit and notifications.                                |

Completion returns the queued durable operation, not chain confirmation. Clients
poll its submission ID. The [application sequence](../../operations/executions.md)
owns idempotency, authority checks, expiry and lifecycle transitions.

## Provider boundaries

[Preparation](prepare.md) calls ERC-4337 estimation and `simulateCalls` with
asset/transfer tracing. The EVM adapter returns protocol-owned preparation and
policy context; no provider client escapes into application code.

[Signature completion and submission](sign-submit.md) recheck sender, EntryPoint,
calldata, nonce, gas, fees and sponsorship. Returned bundler hashes must match
the locally computed canonical hash. Ambiguous transport outcomes retain holds;
absence of a response does not prove the operation was never broadcast.

[Receipt reconciliation](receipts.md) uses persisted signed envelopes and worker
leases to recover after process failure. Included failures still consume gas.
Sponsored mainnet cost is resolved through Alchemy BSO accounting; see
[billing](../../billing/README.md).

## Simulation-only route

Simulation uses the explicitly selected installed session and the same public
account reconstruction and policy checks. It previews reservation decisions
against current state without inserting a submission or changing any budget.
It returns call outcomes, asset changes, native transfers and the selected
session's policy decision. A simulation cannot guarantee later admission because
state and available budgets may change before preparation.
