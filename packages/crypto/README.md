# @namera-ai/crypto

Shared credential cryptography: secure randomness, purpose-separated SHA-256 and
HMAC, and versioned AES-GCM encryption. Wallet signing remains in custody and chain
packages; this package does not store wallet keys.

## Configuration

| Variable                | Purpose                         |
| ----------------------- | ------------------------------- |
| `CRYPTO_HMAC_KEY`       | Required base64url HMAC secret. |
| `CRYPTO_ENCRYPTION_KEY` | Required base64url AES-GCM key. |

`CryptoService.layer` needs Effect's platform `Crypto` service. The server provides
`NodeCrypto.layer`. Secrets are loaded with `Config.Redacted`.

Callers select a stable domain from `cryptoPurpose` for credential hashing, HMAC
and encryption. Length-prefixed purpose separation prevents credentials from being
interchangeable across protocols. AES-GCM authenticates ciphertext and its purpose.
Versioned ciphertext is an encoding contract, not automatic key rotation.

Keep raw credentials, keys, plaintext and ciphertext out of logs and public DTOs.
Persist hashes for lookup credentials and encrypted payloads only when the original
value must be recovered.

## Development

```sh
pnpm --filter @namera-ai/crypto typecheck
pnpm --filter @namera-ai/crypto build
```

Implementation lives in `src/layer.ts`; purposes in `src/data.ts`.
See [authentication](../../architecture/identity-access/authentication.md).
