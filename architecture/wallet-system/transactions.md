# Transaction execution

Namera separates owner transactions from delegated session executions. Both use
the EVM adapter's prepare/sign/submit/receipt pipeline, but have different authority
and persistence boundaries.

| Flow                   | Authority                                                     | Durable record                                     |
| ---------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| Wallet transaction     | Current organization owner using a user session               | `core.wallet_operation`                            |
| Session install/remove | Account-owner approval over stored installation configuration | `core.session_key_operation`                       |
| Delegated execution    | Authenticated actor with an active session grant              | `core.execution_submission`, then `core.execution` |

Wallet transaction and owner-signature routes are not API-key or OAuth signing
shortcuts. Application owner checks require the current system owner role as
well as the relevant permission.

## Preparation and approval

The request selects a namespace, wallet, chain and calls. The adapter reconstructs
the account, validates the chain is enabled, simulates the UserOperation and
returns the exact prepared envelope and gas estimate. Delegated preparation also
binds the selected installed session and checks its authority.

Preparation reserves applicable billing usage before confirmation. Idempotency is
scoped to organization and actor and bound to a request hash. Reusing a key with
different input conflicts; it is not a fresh quote or additional reservation.
An active wallet-chain owner operation excludes a competing owner operation.

Passkey completion verifies the assertion against the prepared operation,
dashboard origin, RP ID and credential. Managed completion loads the bound
provider signer. Local session execution instead verifies the caller's signature
over the prepared signing payload. Acceptance rechecks authority, expiry and
bindings under locks before persisting the signed envelope.

## Sponsorship

Preparation estimates a regular UserOperation. `sponsor: false` selects
self-funding and checks the account's available native funds. Sponsored submission
uses Alchemy BSO: fee fields are zeroed in the submitted operation and the
configured policy is carried in the bundler transport header.

Sponsored mainnet preparation reserves a conservative micro-USD gas amount from
the pre-BSO estimate and price quote. Testnet and unsponsored operations do not
create that mainnet gas reservation. Sponsorship allowance and execution-count
allowance are separate checks.

The identity UI retries preparation as self-funded when sponsorship allowance is
unavailable. The API does not silently reinterpret every sponsored request as
self-funded. Receipt gas cost is not necessarily the BSO provider charge; gas
settlement waits for Alchemy's confirmed sponsorship cost.

## Submission and cancellation

The exact signed envelope and deterministic hash are persisted before RPC.
A durable `broadcastAttempted` marker precedes the send. A lost response therefore
cannot be mistaken for permission to send again.

Cancellation conditionally changes only an unsigned, unclaimed preparation and
releases its reservations in the same lifecycle transaction. It cannot cancel
an already accepted signature, a pending transaction or an uncertain broadcast.
Retrying a cancelled flow requires a new idempotency key.

Receipt processing binds chain, UserOperation hash, account, nonce and EntryPoint
before updating state. Submission is not confirmation. A missing receipt or
transaction hash leaves the operation pending; it does not release its gas hold.

## Code

- [Owner preparation](../../packages/application/src/wallet/transactions/prepare.ts)
- [Owner completion](../../packages/application/src/wallet/transactions/complete.ts)
- [Delegated preparation](../../packages/application/src/execution/prepare-local.ts)
- [Delegated lifecycle](../../packages/application/src/execution/lifecycle.ts)
- [EVM preparation](../../packages/evm/src/execution/prepare.ts)
- [EVM funding](../../packages/evm/src/execution/funding.ts)
- [Billing envelope](../../packages/evm/src/billing/execution.ts)

See [reconciliation](reconciliation.md) for background recovery.
