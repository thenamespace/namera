# @namera-ai/wallet-keys

Provider-neutral asymmetric wallet-key lifecycle and signing for Namera. The
package contains local-development and Google Cloud KMS implementations behind
the same Effect `WalletKeys` service.

See [Wallet-key providers](../../architecture/wallets/wallet-keys.md) for the
provider-neutral lifecycle, signing semantics, and production boundary. See
[chain and custody workspace architecture](../../architecture/packages/chain-custody.md)
for its relationship to `crypto` and the EVM adapter.

## Structure

- `src/service.ts` — provider-neutral `WalletKeys` service contract.
- `src/local.ts` — local PKCS#8 key implementation for development.
- `src/gcp.ts` — Google Cloud KMS implementation.
- `src/test.ts` — deterministic package-owned test implementation.
- `src/config.ts` — local directory and GCP KMS configuration.
- `src/helpers.ts` — local key generation, raw-hash signing, and public-key conversion.

Provider-neutral operation schemas and provider-data shapes live in the protocol
wallet-key model. Implementations consume those decoded contracts directly;
only provider-owned external data, such as local key files and KMS responses,
is validated inside this package.

The package creates, signs with, disables, and destroys provider key material.
Wallet persistence and status transitions, chain-specific signature formatting,
smart-account construction, policy evaluation, and HTTP transport belong to
their respective database, chain adapter, application, and server packages.

`WalletKeys.testLayer` supplies deterministic public keys and signatures for
server boundary tests without writing local files or contacting Google Cloud.
Package-level lifecycle tests exercise real local key creation, message and
pre-hashed signing, disable, and destroy behavior.

## Environment

| Variable                      | Required | Purpose                                       |
| ----------------------------- | -------- | --------------------------------------------- |
| `WALLET_KEYS_LOCAL_DIRECTORY` | Local    | Key directory; defaults to root `.data`.      |
| `GCP_PROJECT_ID`              | GCP      | Google Cloud project containing the key ring. |
| `GCP_KMS_LOCATION`            | GCP      | Key-ring location; defaults to `global`.      |
| `GCP_KMS_KEY_RING`            | GCP      | Existing Google Cloud KMS key ring.           |

The GCP layer uses Application Default Credentials. The local layer stores
mode `0600` PKCS#8 files under `.data/wallet-keys` by default.

Supported combinations are `p256` and `ed25519` at software or HSM protection,
and `secp256k1` at HSM protection. The service returns public key material and
opaque provider data; it never returns a private key.
The local layer is a development substitute and never provides real hardware
protection, even when exercising an HSM-shaped workflow.

`signMessage` hashes ECDSA messages with SHA-256 and passes Ed25519 messages
directly to the provider. `signHash` accepts an already-computed 32-byte digest
for P-256 and secp256k1, so an EVM adapter can supply a Keccak-256 digest without
it being hashed again. ECDSA signatures are DER encoded; Ed25519 signatures are
raw 64-byte values. The GCP layer validates the stored provider algorithm and
uses CRC32C integrity checks for public keys, signing requests, and signatures.

## Adding a key provider or operation

1. Extend the provider-neutral input/result types and `WalletKeys` contract only
   when every provider can expose the same semantic operation.
2. Implement provider details in a focused layer and map failures to
   `WalletKeyError`. Keep provider identifiers and opaque metadata in the
   protocol wallet-key model.
3. Preserve algorithm/protection constraints in the discriminated input type.
   Do not claim a provider supports an algorithm it cannot create and sign.
4. Return raw signatures and public key material only. Chain-specific signature
   formatting and account construction belong in the chain adapter.
5. Keep private key material non-exportable for KMS and mode `0600` for local
   development. Never log payloads, signatures, key files, or credentials.
6. Provide a deterministic package-owned test layer when application/server
   tests need the capability.

## Usage

```ts
import { Effect } from "effect";
import { WalletKeys } from "@namera-ai/wallet-keys";

const program = Effect.gen(function* () {
  const walletKeys = yield* WalletKeys;
  return yield* walletKeys.create({
    id: signingKeyId,
    algorithm: "p256",
    protectionLevel: "software",
  });
}).pipe(Effect.provide(WalletKeys.devLayer));
```

`WalletKeys.layer` uses Google Cloud KMS, `WalletKeys.devLayer` uses local
mode-`0600` key files, and `WalletKeys.testLayer` is deterministic. Composition
roots select one of these layers; provider layers are not separate public APIs.
