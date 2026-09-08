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

  Client->>App: POST /signatures/prepare: wallet + session + chain + payload + idempotency key
  App->>App: hash request; resolve prior attempt
  App->>App: resolve exact active grant and installed local session
  App->>Policy: time, chain, and explicit signature capability evaluation
  App->>Tx: insert reserved operation + reserve anniversary-period signature unit
  App-->>Client: operation ID + replay-safe EIP-712 challenge + expiry
  Client->>Client: verify challenge and sign with local session key
  Client->>App: POST /signatures/complete: operation ID + raw signature
  App->>EVM: verify local ECDSA and installed ERC-1271 authority
  App->>Tx: recheck grant/policies; settle one unit + mark succeeded + audit
  App-->>Client: packed smart-account signature
```

The current `evm.signature` policy explicitly permits message, typed data, or
both. Time-window and chain-allowlist policies also apply. Billing settles
successful operations and holds active reservations, preventing concurrent
requests from crossing the organization's anniversary-period quota.

The exact session must also have owner-approved `onchain.allowSignatures`.
The server never signs with the wallet owner. The legacy synchronous
`POST /signatures` route fails closed with `SIGNATURE_UNAVAILABLE` until its
clients migrate; API-key and CLI actors can use prepare/complete now.

Preparation reserves one unit for at most five minutes, bounded by session and
API time-window expiry. Reusing the same actor/idempotency key with different
input fails; identical retries reuse the operation and reservation. Completion
loads the original payload from persistence and rechecks actor, grant, policy
hash, installation, and expiry. Invalid signatures remain retryable while the
reservation is live. Successful completion retries verify authority again but
do not charge twice. Signature bytes are never persisted.

The billing reconciliation worker expires abandoned reservations, records
`PREPARATION_EXPIRED`, and releases capacity. It skips locked signature rows
rather than reversing completion's operation/billing lock order. Preparation
and success write `signature.prepared` and `signature.created` audit events
inside their transactions. Existing signature duration, result, policy and
verification metrics use bounded attributes.

These quotas govern Namera API completions, not signatures made directly by a
local key holder. Alchemy's time hook does not expire ERC-1271 signature
authority: onchain uninstall is required to revoke it. API expiry is not an
onchain restriction and must be disclosed in client consent.

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

- Wire SDK, CLI and local MCP to prepare, validate the challenge, sign locally,
  and complete. Migrate remote-MCP authentication separately.
- Complete end-to-end browser consent/import coverage and consumer conformance.
- Add namespace-specific signature variants only with another chain adapter.
- Add EIP-712 domain/verifying-contract/primary-type policy restrictions before
  allowing broad typed-data signing in public production.
- Add per-session-key signature count policies through the existing generic
  reservation model if product delegation limits require them.
