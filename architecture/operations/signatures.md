# Signatures and verification

Namera supports EVM smart-account message signing and EIP-712 typed-data
signing. Raw digest signing is not public. Delegated signature creation is policy-gated,
metered, idempotent, and persisted as an operation; verification is read-only
and unmetered.

## Persistence and EVM internals

The canonical `core.signature_operation` column, lifecycle check, keys, foreign
keys, and indexes are in the
[core database catalog](../database/core-wallets-operations.md#coresignature_operation).
Digesting, smart-account signing, deployed ERC-1271 verification, and
counterfactual factory verification are documented in
[EVM signatures](../evm/signatures.md).

For delegated signing, returned signature bytes are never persisted or logged. The message or
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
The server never signs with the wallet owner. Clients use prepare/complete.

### Managed session signing

`POST /signatures/prepare` reserves the same supported message or typed-data
operation for an installed 1Claw session. `/signatures/complete` accepts
only namespace and operation ID, not a digest or signature. Both require the same
machine-actor grants, OAuth scopes and rate limits as local signing. Preparation
retains the installation ID and an internal public signer-binding snapshot, while
the response returns `signing: { method: "server" }`. The same endpoints serve
local sessions with an EIP-712 challenge and mandatory completion signature.
Custody comes from the stored session/preparation, never a caller flag.
SDK `sign`, CLI and MCP select the path automatically; managed completion has no
automatic transport retry, because its signature bytes are not stored.

Completion exclusively claims a two-minute signing lease, loads the encrypted
agent credential for the session-purpose key, and signs the EVM adapter's
replay-safe EIP-712 challenge outside transactions. The existing adapter verifies
ECDSA identity and installed ERC-1271 authority and builds the account envelope.
Acceptance locks the wallet, grant, signer and provider connection and rechecks
policy, installation, identity, expiry and lease ownership before atomically
settling billing, marking success and auditing. Revocation during provider work
cannot return the resulting signature. Expired lease owners cannot settle.

No returned signature bytes are persisted, even encrypted. A successful managed
operation cannot replay its result: repeated completion or preparation with the
same idempotency key returns `SIGNATURE_UNAVAILABLE`. If a successful response was
lost, explicitly prepare with a fresh idempotency key; authorization, policy and
quota are checked again and another successful attempt is charged. An interrupted
reserved attempt may be retried after its lease expires, before the reservation
deadline. Provider failures do not automatically retry. Expiry recovery clears
the lease and releases the hold; late provider results are rejected. Local
completion retains its existing client-supplied-signature replay behavior.

Managed HTTP tests cover both parent custodians, messages and typed data, real
ECDSA verification, concurrent single completion, fresh billable retries,
disabled signature permission, policy denial, actor isolation, payload-bound
idempotency, installation eligibility, expiry, stale leases and revocation during
verification. PostgreSQL runs exercise real row locks and settlement. Provider
and ERC-1271 responses are substitutes; live signing remains a deployment smoke
test, not something performed by these tests.

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

The HTTP integration suite races eight late completions against eight recovery
passes after expiry. PostgreSQL coverage verifies one recovered hold, no late
success, one failed operation, and no retained or consumed signature quota.
A complementary eight-way valid-completion race returns identical results to
every caller with one settled reservation, one consumed unit and one
`signature.created` audit event. Both races use the real HTTP/application and
PostgreSQL transaction boundaries; chain verification remains a package-owned
provider substitute, not a live ERC-1271 test.
A separate delayed-provider case starts completion before expiry, confirms it
is still in flight after expiry, recovers the hold, then lets verification
finish. Settlement rejects the recovered operation and quota remains unchanged.

These quotas govern Namera API completions, not signatures made directly by a
local key holder. Alchemy's time hook does not expire ERC-1271 signature
authority: onchain uninstall is required to revoke it. API expiry is not an
onchain restriction and must be disclosed in client consent.

## Owner wallet signing

Dashboard-only `POST /wallets/:walletId/signatures/prepare` and
`POST /wallets/:walletId/signatures/complete` create owner signatures without a
session key. Both require an authenticated user with the system Owner role and
`wallet:update`, the configured dashboard Origin, and a shared 60/minute/user
limit. API-key, CLI and MCP actors are forbidden regardless of grants/scopes.
The routes are excluded from published OpenAPI and have no SDK/CLI/MCP wrapper.

Preparation accepts an idempotency header and the existing EVM message or typed-data
fields, discriminated by `namespace` and `type`. It validates the account and
payload without signing, then persists a five-minute approval bound to actor,
tenant, wallet, signing key, owner identity and request hash. Its response includes
the original request, account, expiry and either passkey authentication options or
`signing: { method: "server" }`. Completion accepts namespace, operation ID and
a passkey response only when required by stored custody; callers cannot change
the payload or choose custody at completion.

Passkeys sign Alchemy's account/chain/payload-bound replay-safe challenge. Namera
verifies origin, RP ID, user verification, credential and counter before packing
the account signature. Managed owners sign through 1Claw only at completion.
A two-minute exclusive lease fences signing; provider work has a 90-second timeout.
The final transaction locks wallet/key/provider state, rechecks Owner membership,
binding and expiry, advances the passkey counter, stores success and writes
`wallet.signature_created`. Preparation writes `wallet.signature_prepared`
atomically with its row. Neither audit event contains the payload or signature.

Unlike delegated signing, owner completion stores its response encrypted with a
purpose bound to tenant, actor, operation and request hash. A lost successful
response can be replayed by the same authorized actor without signing again,
including after preparation expiry. Current owner/key availability is checked
on replay. Prepared retries reuse the same operation; changed input under the
same key conflicts. Invalid assertions/provider failures release the lease and
remain retryable until expiry. Expired approvals cannot complete, and a new
idempotency key is required. No worker, gas reservation or transaction submission
is involved; owner signatures currently do not consume delegated signature quota.

The challenge is bound to the signable payload, not a fresh authentication nonce.
Applications must include their own nonce/domain/expiry in login or authorization
payloads. Preparation expiry does not expire a returned cryptographic signature.
Counterfactual signatures require an ERC-6492-aware verifier; ordinary EOA
signature recovery is insufficient.

HTTP tests cover passkey messages/typed data, managed sign-once replay, encrypted
storage, actor/tenant/origin boundaries, API-key rejection, invalid assertions,
expiry, disabled keys and lease fencing. Adapter unit tests cover deployed and
undeployed envelopes. Chain/provider substitutes are used; live external
verification and frontend upload/consent integration remain separate work.
Rows/results currently have no automatic retention cleanup.

## Verification

`POST /signatures/verify` accepts the original message or typed data and a
signature. The EVM adapter reconstructs the smart account and:

- uses ERC-1271 contract signature verification for deployed accounts;
- supplies deterministic factory data for ERC-6492 counterfactual verification;
- returns an invalid signature as data rather than an exceptional defect.

Verification requires an active wallet grant but no signature policy because it
does not create authority. Both passkey and 1Claw-owned accounts use the shared
public-only owner reconstruction, independently of session-key custody. This
validates the active owner binding without loading credentials or invoking a
provider signer. HTTP regression coverage verifies message and typed-data
results for both owner types, including invalid signatures as `valid: false`.
It does not persist an operation, consume billing,
write audit, or return private provider details. A dedicated actor rate limit
and bounded verification metrics protect the boundary.

## Policy boundary verification

The signature HTTP suite creates and installs a session with `typedDataRules`,
then verifies a mismatched domain is denied with the policy ID before billing or
signature audit writes. A corrected request reuses the unconsumed idempotency key
and completes with one charged signature. Provider signing/receipt services are
test substitutes; the API, policy engine and persistence are real.
