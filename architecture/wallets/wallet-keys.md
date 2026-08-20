# Wallet-key providers

`@namera-ai/wallet-keys` owns asymmetric key creation, signing, disablement, and
destruction behind one provider-neutral Effect service. Application and EVM code
never import a provider client directly.

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

## Signing semantics

ECDSA message signing hashes with SHA-256; Ed25519 signs the message directly.
`signHash` accepts an already-computed digest for P-256 and secp256k1 so EVM can
provide Keccak-256 without double hashing. ECDSA signatures are DER encoded and
converted by the EVM adapter where required; Ed25519 signatures are raw 64-byte
values.

## Runtime configuration

| Variable                      | Purpose                                |
| ----------------------------- | -------------------------------------- |
| `WALLET_KEYS_PROVIDER`        | Select local or GCP KMS in the server. |
| `WALLET_KEYS_LOCAL_DIRECTORY` | Development key directory.             |
| `GCP_PROJECT_ID`              | KMS project.                           |
| `GCP_KMS_LOCATION`            | KMS location, default `global`.        |
| `GCP_KMS_KEY_RING`            | Existing key ring.                     |

## Pending

- Add operator-visible cleanup for provider keys not referenced by a committed
  wallet row.
- Run live GCP integration tests before production algorithm or protection
  changes.
- Document operator recovery for disable/destroy failures.
