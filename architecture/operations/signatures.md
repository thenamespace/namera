# Signatures and verification

Namera supports EVM smart-account message signing and EIP-712 typed-data
signing. Raw digest signing is not public. Signature creation is policy-gated,
metered, idempotent, and persisted as an operation; verification is read-only
and unmetered.

## Table: `core.signature_operation`

| Field group | Meaning                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Identity    | ID, organization, actor, wallet, session key, grant, namespace.                                                |
| Idempotency | Actor-scoped idempotency key, request hash, policy hash.                                                       |
| Lifecycle   | `reserved`, `succeeded`, or `failed`; reservation expiry; success/failure timestamps and bounded failure code. |
| Data        | Fully discriminated EVM message or typed-data operation, including chain/account and original content.         |
| Metadata    | Creation/update timestamps.                                                                                    |

Composite foreign keys prove that actor, wallet, key, and grant all belong to
the organization and one another. `(organization, actor, idempotency_key)` is
unique. Indexes serve organization, wallet, session-key/status, and actor
history. A lifecycle check requires timestamps/failure code to match status.

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
  App->>Tx: lock billing; reserve monthly signature; insert reserved operation
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
both. Time-window and chain-allowlist policies also apply. Billing counts
successful operations plus unexpired reservations, preventing concurrent
requests from crossing the organization monthly quota.

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
