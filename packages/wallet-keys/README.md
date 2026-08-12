# @namera-ai/wallet-keys

Provider-neutral asymmetric wallet-key creation and signing for Namera. The
package contains local-development and Google Cloud KMS implementations behind
the same Effect `WalletKeys` service.

## Structure

- `src/service.ts` — provider-neutral `WalletKeys` service contract.
- `src/data.ts` — creation, signing, and result types.
- `src/local.ts` — local PKCS#8 key implementation for development.
- `src/gcp.ts` — Google Cloud KMS implementation.
- `src/config.ts` — local directory and GCP KMS configuration.
- `src/helpers.ts` — public-key conversion shared by providers.

The package creates keys and signs bytes. Wallet persistence, chain-specific
signature formatting, smart-account construction, policy evaluation, and HTTP
transport belong to their respective database, chain adapter, application, and
server packages.

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
and `secp256k1` at HSM protection. The service returns public key material and a
provider key-version reference; it never returns a private key.
The local layer is a development substitute and never provides real hardware
protection, even when exercising an HSM-shaped workflow.

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
import { LocalWalletKeysLayer, WalletKeys } from "@namera-ai/wallet-keys";

const program = Effect.gen(function* () {
  const walletKeys = yield* WalletKeys;
  return yield* walletKeys.create({
    id: walletKeyId,
    algorithm: "p256",
    protectionLevel: "software",
  });
}).pipe(Effect.provide(LocalWalletKeysLayer));
```
