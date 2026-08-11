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
