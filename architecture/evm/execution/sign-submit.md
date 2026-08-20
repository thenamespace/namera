# Sign and submit

Signing proves the prepared context still matches the reconstructed account and serialized UserOperation. Submission proves the signed object hashes to the expected UserOperation hash and that the bundler returns the same hash.

## Sign integrity checks

Before calling the owner signer, the adapter reconstructs the account and compares:

- prepared chain ID with context chain ID;
- context account and serialized sender with reconstructed address;
- EntryPoint address and version with reconstructed account;
- account-encoded calls with serialized `callData`;
- context nonce with serialized nonce;
- every gas/fee/paymaster field with serialized UserOperation.

Any mismatch returns `SIGNING_FAILED`; no signature is produced.

```mermaid
sequenceDiagram
  participant App
  participant EVM
  participant Account as Reconstructed smart account
  participant Owner as Wallet-key owner
  App->>EVM: account + prepared execution
  EVM->>Account: encodeCalls(context.calls)
  EVM->>EVM: Compare account, EntryPoint, calls, nonce, gas, fees, paymaster
  EVM->>Account: signUserOperation
  Account->>Owner: Sign account-specific UserOperation payload
  Owner-->>Account: Signature
  EVM->>EVM: Compute EntryPoint UserOperation hash and normalize signed operation
  EVM-->>App: EvmSignedExecution v1
```

## Submission

The adapter reconstructs the Viem UserOperation and independently computes `getUserOperationHash` from chain ID, EntryPoint address/version, and signed fields. It rejects a mismatch before RPC. Pimlico `sendUserOperation` must return that exact hash; a different result is `SUBMISSION_HASH_MISMATCH`.

## Error classification

| Error                      | Meaning                                                     | Reservation behavior                               |
| -------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| `SUBMISSION_REJECTED`      | Provider returned a recognized RPC rejection; not accepted. | Application may release/fail after status logic.   |
| `SUBMISSION_UNKNOWN`       | Transport/provider failure leaves acceptance ambiguous.     | Keep reservation; mark submitted and reconcile.    |
| `SUBMISSION_HASH_MISMATCH` | Stored/signed/bundler hash integrity violation.             | Definitive failure; release after lifecycle guard. |

This classification is critical. Treating a timeout as rejection can double-spend a periodic budget if the bundler actually accepted the operation.

## Durable transition order

1. Persist signed execution and mark submission prepared.
2. Call external bundler.
3. For success or ambiguous failure, transactionally mark submission/reservations submitted and write `execution.submitted` audit.
4. For definitive failure, transactionally release reservations and write `execution.failed`.

The signed execution is persisted before submission so reconciliation can safely retry or query status after process failure.

## Pending before production

- Test provider error classification against actual Pimlico/HTTP failure shapes.
- Add alerting for hash mismatch; it indicates a severe integration or data-integrity problem.
- Document retry/backoff and provider idempotency behavior for repeated `sendUserOperation`.
