# Wallet-key providers

`@namera-ai/wallet-keys` owns asymmetric key creation, signing, disablement, and
destruction behind one provider-neutral Effect service. Application and EVM code
never import a provider client directly.

The server composes `WalletKeys.disabledLayer` in every environment. Public
wallets use browser passkeys, while routine execution and signatures use local
session keys. This document describes the retained provider package, not an
active managed-custody product flow.

## Service contract

`WalletKeys` exposes:

- create key material for a protocol-typed algorithm/protection input;
- sign a message;
- sign an already-computed 32-byte digest;
- disable a key;
- destroy a key.

The service returns public key material, raw provider signatures, and opaque
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

Creates PKCS#8 files below `.data/wallet-keys` by default. The directory uses
mode `0700` and files mode `0600`. Active/disabled state is persisted with the
local key record; destruction removes the file.

### Google Cloud KMS

Creates asymmetric keys in an existing key ring, uses software or HSM protection
where supported, and signs without exporting private material. It validates the
stored provider algorithm and verifies CRC32C integrity metadata for public-key
and signing responses. Application Default Credentials and Workload Identity
provide authentication.

### Test layer

A package-owned deterministic layer supplies stable public keys and signatures
for server boundary tests. Consumers do not invent separate wallet-key mocks.

### 1Claw contract preparation

Protocol has an explicit `1claw` variant, but there is no provider implementation
or live layer yet. Local, GCP and test creation reject this variant instead of
creating substitute local/KMS material. The server still uses the disabled layer.

The accounts-first operation contract supports Ethereum/secp256k1 creation,
32-byte digest signing and disablement only. It does not require or claim HSM
protection. Message signing and destruction exclude 1Claw; deactivation is not
destruction. Existing GCP/local contracts and their HSM restriction are unchanged.
Provider failures can carry bounded `WalletKeyError.code` categories without
changing existing error construction; provider response mapping is not wired yet.

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

Next steps are provider implementation and managed EVM
workflows. Partial remote provisioning will use manual recovery in this iteration;
no automatic retry of ambiguous creation or automatic key destruction is allowed.

## Signing semantics

ECDSA message signing hashes with SHA-256; Ed25519 signs the message directly.
`signHash` accepts an already-computed digest for P-256 and secp256k1 so EVM can
provide Keccak-256 without double hashing. ECDSA signatures are DER encoded and
converted by the EVM adapter where required; Ed25519 signatures are raw 64-byte
values.

## Runtime configuration

The self-custodial server composes `WalletKeys.disabledLayer` in every environment.
It needs no wallet-key provider configuration and rejects all managed-key operations
with `WalletKeyError`. Passkey and session signing happen on clients. The local and
GCP providers below remain available only through explicit layer composition.

| Variable                      | Purpose                         |
| ----------------------------- | ------------------------------- |
| `WALLET_KEYS_LOCAL_DIRECTORY` | Development key directory.      |
| `GCP_PROJECT_ID`              | KMS project.                    |
| `GCP_KMS_LOCATION`            | KMS location, default `global`. |
| `GCP_KMS_KEY_RING`            | Existing key ring.              |
