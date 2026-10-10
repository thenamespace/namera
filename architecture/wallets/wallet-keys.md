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

The GCP and local services expose `createKey`, `signMessage`,
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

### 1Claw provider (internal, not wired)

`@namera-ai/wallet-provider-oneclaw` uses SDK `0.61.38` and exposes grouped
connection, customer, agent, signing-key and digest-signing operations through
`OneClawService`. `OneClawOidcService` independently issues short-lived RS256 org
identity tokens and exposes public JWKS. There is no universal provider facade.
Application still rejects 1Claw before provider work, and server composition
remains unchanged. See the [package README](../../packages/wallet-providers/oneclaw/README.md)
for operation signatures, configuration and tests.

Organization setup validates a dashboard-created active empty template, app ID
and version, then bootstraps without resources. Claims are redacted and redeemed
without the Platform credential; the returned customer token is verified through
authenticated identity lookup before use. Customer operations validate the
`OneClawCustomerAuthority` connection/credential/payload bindings, configured
app and expiration. Delegation grants only `agents:read` and `agents:write`.

Every account uses the same delegated Platform agent creation. The internal
`OneClawOrganizationSetupRequest` is distinct from the ready-connection
`OneClawOwnerProvisioningRequest`; the latter no longer accepts bootstrap/
incremental modes. The early credential result remains bound to its preallocated
credential and organization IDs. Application must encrypt/save this one-time
agent key before any later provider call. Customer auth creates the Ethereum
key and updates raw signing. Raw-signing changes are read back, including
approval/deny outcomes.

Signing receives the decoded agent credential, pinned key ID/version/public
identity and 32 digest bytes. It explicitly exchanges the credential for a fresh
token, validates current Ethereum/secp256k1 metadata and the public curve point,
then verifies the returned signature against the exact digest and expected
public key. It does not hash again, broadcast, or claim HSM guarantees.
The result is a verified 65-byte recoverable provider signature; EVM owns
validator-specific encoding. Key destruction returns `UNSUPPORTED`.

`OneClawError` lives in protocol. Central SDK-envelope/exception conversion
retains only bounded operation/code and optional HTTP status. It never attaches
provider messages, response bodies, parse errors, URLs, or credentials. Stable
`wallet-providers.oneclaw.*` spans have no payload attributes; there are no new
logs or metrics. OIDC issuance is untraced. HTTP instrumentation must not capture
claim-token paths or auth headers.

The SDK cannot cancel in-flight requests. Effect timeouts bound the caller's
wait, not remote execution. No calls retry automatically. An ambiguous mutation
requires reconciliation/manual recovery, not another create. Template version
checking cannot be atomic with bootstrap; freeze the configured template.
Delegated read access is probed after enabling scopes; create proves write
permission. Scope/identity checks do not replace application tenant authorization.

Protocol persists `1claw` signer locators and separate `1claw-agent` and
`1claw-customer` credentials. The customer variant has required expiration;
decrypted payloads are redacted and bound to organization/connection identity.
Phase 3A already provides ciphertext-only repositories, org-scoped foreign keys,
connection setup/renewal leases and ciphertext compare-and-swap. See the
[table catalog](../database/core-wallets-operations.md). This provider phase adds
no tables or migrations. Encryption/renewal workflows and transactional audits
remain application integration work using `cryptoPurpose.providerCredential`
and the existing encryption key.

Managed factory-based ERC-4337 owner reconstruction, public OIDC discovery/JWKS
hosting and rotation, server composition, and live OIDC empty-bootstrap
verification remain open. Current passkey/local signing and internal 7702
behavior are unchanged. Persisted non-Ethereum chain variants are schema
preparation, not adapter support. Deprecated WalletKeys operation schemas remain
published compatibility exports, not a runtime interface.

## Signing semantics

For GCP/local, ECDSA message signing hashes with SHA-256; Ed25519 signs the message directly.
`signDigest` accepts an already-computed digest for P-256 and secp256k1 so EVM can
provide Keccak-256 without double hashing. Their ECDSA signatures are DER encoded and
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
