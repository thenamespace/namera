# Wallet-key providers

Independent `@namera-ai/wallet-provider-gcp` and
`@namera-ai/wallet-provider-local` packages own asymmetric key creation, signing,
disablement and destruction through `GcpService` and `LocalService`. There is no
shared provider service or fallback. Application selects the explicit service;
EVM receives signing callbacks and imports neither provider. Provider clients and
private material remain package-owned.

The server composes both provider-specific `disabledLayer` implementations in every environment. Public
wallets use browser passkeys, while routine execution and signatures use local
session keys. This document describes the retained provider package, not an
active managed-custody product flow.

## Service contract

Each independent service currently exposes `createKey`, `signMessage`,
`signDigest`, `disableKey`, and `destroyKey` to:

- create key material for a protocol-typed algorithm/protection input;
- sign a message;
- sign an already-computed 32-byte digest;
- disable a key;
- destroy a key.

Each service returns public key material, raw provider signatures, and opaque
provider data. Chain-specific message hashing, signature formatting, smart-
account construction, and policy evaluation remain in the chain adapter.

## Supported combinations

| Algorithm | Software | HSM |
| --------- | -------- | --- |
| P-256     | yes      | yes |
| Ed25519   | yes      | yes |
| secp256k1 | no       | yes |

The local provider exercises the common protection-shaped contract but does not
provide hardware isolation.

## Providers

### Local development

Creates PKCS#8 files below `.data/wallet-keys` by default. The split preserves
that path in source and unbundled builds, every existing locator and version-1 file. The directory uses
mode `0700` and files mode `0600`. Active/disabled state is persisted with the
local key record; destruction removes the file.

### Google Cloud KMS

Creates asymmetric keys in an existing key ring, uses software or HSM protection
where supported, and signs without exporting private material. It validates the
stored provider algorithm and verifies CRC32C integrity metadata for public-key
and signing responses. Application Default Credentials and Workload Identity
provide authentication.

### Test layer

Each package owns a deterministic test layer supplying stable public keys and signatures
for server boundary tests. Consumers do not invent separate wallet-key mocks.

### 1Claw contract preparation

Protocol has an explicit `1claw` variant, but there is no provider implementation
or live layer yet. Local/GCP live creation rejects provider-discriminated requests instead of
creating substitute material. Application rejects 1Claw before any provider call.
The server still uses both disabled layers.

The deprecated accounts-first operation contract describes Ethereum/secp256k1 creation,
32-byte digest signing and disablement only. It does not require or claim HSM
protection. Message signing and destruction exclude 1Claw; deactivation is not
destruction. Existing GCP/local contracts and their HSM restriction are unchanged.
Legacy operation schemas and `WalletKeyError` remain deprecated published protocol
exports only. They are not a runtime provider interface. New packages own their
operation schemas and `GcpKeyError`/`LocalKeyError`; shared persisted models and
locators remain in protocol. The future 1Claw service will own its vendor decoding
and errors.

Creation takes an organization ID and preallocated credential ID. Its result
contains public material, pinned agent/key/version metadata and a credential
envelope with a redacted API key for later application-owned encryption. Signing
and disablement take tenant-scoped credential references, never public API
credentials. The future provider must validate the requested organization,
credential, agent, key/version and public identity before signing.

The canonical `SigningKey` model correlates metadata chain families with algorithms:
Ethereum/Bitcoin/Tron use secp256k1 and Solana/XRP/Cardano use Ed25519. This is model
support only, not non-EVM account or operation support. The legacy standalone
`WalletKey` model remains local/GCP-only; 1Claw does not get a competing identity.

Protocol also defines `Credential`/`CredentialInsert` for the generic
`core.credentials` table. The first variant is `1claw-agent`, containing versioned
non-secret agent metadata and encrypted payload. The decrypted envelope binds
credential ID, organization ID and agent ID to the API key. Encryption will use
`cryptoPurpose.providerCredential` with existing `CRYPTO_ENCRYPTION_KEY`. Binding
verification and key rotation are not implemented by these schemas. Phase 3 adds
the table, ciphertext-only repository and organization-scoped signer foreign key.
1Claw signers require top-level `credentialId`; existing records migrate to null.
No encryption/decryption workflow, provisioning-attempt table or provider API call
is wired. Database checks validate metadata shape and chain/algorithm pairing;
the future provider must still verify credential type and agent identity.

Phase 2A adds internal `ProviderConnection` readiness/identity schemas, a
`1claw-customer` credential variant with required expiration and redacted token,
and `OneClawCustomerAuthority` binding checks across connection, credential row
and decrypted payload. Bootstrap and incremental owner requests are distinct;
the early agent result binds its one-time credential to the request's organization
and credential ID. `ProviderConnectionError` carries bounded internal failure codes.
These schemas do not verify token signatures, current-time expiry, provider
revocation or database ownership by themselves. JSON encoding of decrypted
envelopes is only for encryption, never public responses or logging.

Phase 3A adds customer credential expiry/storage, organization/provider connections,
nullable legacy signer linkage, tenant-safe foreign keys and transaction-aware
repositories. A pending local reservation may omit remote/customer IDs until
reconciled; bootstrap requests require those IDs. Token-owned setup/renewal leases
and ciphertext compare-and-swap protect local transitions, tested on PostgreSQL.
See the [table catalog](../database/core-wallets-operations.md) for invariants and
recovery limits. No customer-token renewal HTTP, OIDC endpoint or public capability
is enabled here. The
factory-based ECDSA schema remains gated on factory compatibility evidence; current
passkey and 7702 shapes are unchanged. Vendor claim-response decoding belongs in
the future 1Claw package. The phase 4A provider-specific split is complete; 1Claw runtime work remains
phase 4B.

Next steps are provider implementation and managed EVM
workflows. Partial remote provisioning will use manual recovery in this iteration;
no automatic retry of ambiguous creation or automatic key destruction is allowed.

## Signing semantics

ECDSA message signing hashes with SHA-256; Ed25519 signs the message directly.
`signDigest` accepts an already-computed digest for P-256 and secp256k1 so EVM can
provide Keccak-256 without double hashing. ECDSA signatures are DER encoded and
converted by the EVM adapter where required; Ed25519 signatures are raw 64-byte
values.

## Verification and compatibility

Provider tests verify local signatures, exact-digest signing, persisted-key reopening,
permissions, duplicate-create protection, disabled keys and destruction. GCP tests
substitute the SDK transport to check CRCs, identity/algorithm checks, lifecycle
requests and client release without cloud access. Both disabled layers need no
configuration. Application/server tests retain public custody gates and passkey
flows. No schema migration, key regeneration or new public API is part of the split.
Provider spans now use the `wallet-providers.*` namespace.

## Runtime configuration

The self-custodial server composes `GcpService.disabledLayer` and
`LocalService.disabledLayer` in every environment.
It needs no wallet-key provider configuration and rejects all managed-key operations
with the corresponding provider-specific error. Passkey and session signing happen on clients. The local and
GCP providers below remain available only through explicit layer composition.

| Variable                      | Purpose                         |
| ----------------------------- | ------------------------------- |
| `WALLET_KEYS_LOCAL_DIRECTORY` | Development key directory.      |
| `GCP_PROJECT_ID`              | KMS project.                    |
| `GCP_KMS_LOCATION`            | KMS location, default `global`. |
| `GCP_KMS_KEY_RING`            | Existing key ring.              |
