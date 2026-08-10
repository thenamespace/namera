# @namera-ai/application

The backend use-case layer and center of Namera's business logic. It composes
repositories and provider services into raw operations such as magic-link sign
in, session management, and future backend workflows. It is independent of HTTP
and does not perform API authorization checks; `apps/server` owns those checks
and adapts HTTP requests to application methods.

## Structure

- `src/application.ts` — the single aggregate `Application` service and live layer.
- `src/auth/core/` — focused user and session operations.
- `src/auth/magic-link/` — request and verification workflows.
- `src/auth/organization/` — organization, member, invitation, and setup operations.
- `src/auth/organization/helpers.ts` — shared transactional user and organization setup.
- `src/auth/config.ts` — environment-backed authentication configuration.
- `src/auth/data.ts` — code-owned authentication policy and defaults.
- `src/crypto/config.ts` — redacted cryptographic secrets.
- `src/crypto/data.ts` — stable domain-separation purposes.
- `src/crypto/layer.ts` — reusable hashing, HMAC, encryption, and random-value service.
- `src/wallet-keys/` — provider-neutral P-256 key creation and signing through
  local files or Google Cloud KMS.
- `MAGIC_LINK.md` — implementation contract for magic-link authentication.

Future feature folders should add a focused operation builder to the aggregate
service. Infrastructure capabilities such as crypto and wallet signing remain
focused `Context.Service` values that the aggregate can consume.

## Usage

```ts
import { Effect } from "effect";
import * as Application from "@namera-ai/application";

const program = Effect.gen(function* () {
  const app = yield* Application.Application;
  return yield* app.organization.invitation.createInvitation(input);
});
```

`Application.layer` is the only application layer provided by the server.

## Environment

| Variable                       | Required | Purpose                                          |
| ------------------------------ | -------- | ------------------------------------------------ |
| `AUTH_API_PUBLIC_ORIGIN`       | Yes      | Public origin of `api.namera.ai`.                |
| `AUTH_DASHBOARD_PUBLIC_ORIGIN` | Yes      | Public dashboard origin.                         |
| `CRYPTO_HMAC_KEY`              | Yes      | Base64url key used by HMAC operations.           |
| `CRYPTO_ENCRYPTION_KEY`        | Yes      | Base64url AES key used by encryption operations. |
| `WALLET_KEYS_LOCAL_DIRECTORY`  | Local    | Local key directory; defaults to root `.data`.   |
| `GCP_PROJECT_ID`               | GCP      | Google Cloud project containing the key ring.    |
| `GCP_KMS_LOCATION`             | GCP      | Key-ring location; defaults to `global`.         |
| `GCP_KMS_KEY_RING`             | GCP      | Existing Google Cloud KMS key ring.              |

Editable TTLs, limits, cookie settings, and return paths live in
`src/auth/data.ts` rather than environment variables.

## Configuration and crypto

```ts
import { Effect, Layer } from "effect";
import { NodeCrypto } from "@effect/platform-node";
import { AuthConfig, CryptoService } from "@namera-ai/application";

const CryptoLive = CryptoService.layer.pipe(Layer.provide(NodeCrypto.layer));

const program = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  return yield* crypto.randomToken(config.magicLink.tokenBytes);
});
```

Effect's `Crypto` service provides secure randomness and SHA digests. The
application crypto service adds purpose-separated HMAC and AES-GCM operations.
`apps/server` must provide `NodeCrypto.layer`.

## Wallet keys

`WalletKeys` exposes only key creation and signing. Provider clients and private
keys stay inside its Layers. The local Layer stores mode `0600` PKCS#8 files in
the repository's ignored `.data/wallet-keys` directory and emulates both
protection levels for development. The GCP Layer creates P-256, Ed25519, or
secp256k1 keys in an existing key ring and uses Application Default Credentials.
P-256 and Ed25519 support software or HSM protection; secp256k1 is HSM-only.

```ts
import { Effect } from "effect";
import { LocalWalletKeysLayer, WalletKeys } from "@namera-ai/application";

const program = Effect.gen(function* () {
  const walletKeys = yield* WalletKeys;
  const key = yield* walletKeys.create({
    id: walletKeyId,
    algorithm: "p256",
    protectionLevel: "software",
  });

  return yield* walletKeys.sign({
    keyVersionName: key.keyVersionName,
    algorithm: key.algorithm,
    payload: transactionHash,
  });
}).pipe(Effect.provide(LocalWalletKeysLayer));
```

Do not import API route definitions or read `process.env` in application use
cases. Validate public input in protocol/API schemas and keep use cases focused
on business behavior and atomic coordination.
