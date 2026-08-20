# Signatures and verification

Namera supports EVM smart-account message signing and EIP-712 typed-data
signing. Raw digest signing is not public. Signature creation is policy-gated,
metered, idempotent, and persisted as an operation; verification is read-only
and unmetered.

## Persistence and EVM internals

The canonical `core.signature_operation` column, lifecycle check, keys, foreign
keys, and indexes are in the
[core database catalog](../database/core-wallets-operations.md#coresignature_operation).
Digesting, smart-account signing, deployed ERC-1271 verification, and
counterfactual factory verification are documented in
[EVM signatures](../evm/signatures.md).

The returned signature bytes are never persisted or logged. The message or
typed data is persisted because it is the auditable metered operation and is
required to understand what authority was used.

## Signing flow

```mermaid
sequenceDiagram
  participant Client
  participant App as Signature application
  participant Policy as EVM policy service
  participant Tx as PostgreSQL transaction
  participant EVM

  Client->>App: wallet + chain + message/typed data + internal idempotency key
  App->>App: hash request; resolve prior attempt
  App->>App: find active account/grant/session-key candidates
  App->>Policy: time, chain, and explicit signature capability evaluation
  App->>Tx: insert reserved operation + reserve anniversary-period signature unit
  App->>EVM: reconstruct Kernel/Safe and sign
  alt success
    App->>Tx: mark succeeded + audit + settle policy reservations
    App-->>Client: signature bytes + safe operation details
  else definitive signing failure
    App->>Tx: mark failed + release capacity/reservations
    App-->>Client: typed failure
  end
```

The current `evm.signature` policy explicitly permits message, typed data, or
both. Time-window and chain-allowlist policies also apply. Billing settles
successful operations and holds active reservations, preventing concurrent
requests from crossing the organization's anniversary-period quota.

SDK, CLI, and MCP generate and reuse the idempotency key across transient
retries. Declared policy, billing, authorization, and validation failures are not
retried.

## Verification

`POST /signatures/verify` accepts the original message or typed data and a
signature. The EVM adapter reconstructs the smart account and:

- uses ERC-1271 contract signature verification for deployed accounts;
- supplies deterministic factory data for ERC-6492 counterfactual verification;
- returns an invalid signature as data rather than an exceptional defect.

Verification requires an active wallet grant but no signature policy because it
does not create authority. It does not persist an operation, consume billing,
write audit, or return private provider details. A dedicated actor rate limit
and bounded verification metrics protect the boundary.

## Pending

- Add namespace-specific signature variants only with another chain adapter.
- Add EIP-712 domain/verifying-contract/primary-type policy restrictions before
  allowing broad typed-data signing in public production.
- Add per-session-key signature count policies through the existing generic
  reservation model if product delegation limits require them.
