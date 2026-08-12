# @namera-ai/crypto

Shared cryptographic operations for Namera. It builds domain-separated hashing,
HMAC, authenticated encryption, and random credential generation on Effect's
platform `Crypto` service.

## Structure

- `src/config.ts` — redacted HMAC and encryption key configuration.
- `src/data.ts` — stable domain-separation purposes.
- `src/layer.ts` — `CryptoService` implementation.
- `src/index.ts` — public exports.

## Environment

| Variable                | Required | Purpose                           |
| ----------------------- | -------- | --------------------------------- |
| `CRYPTO_HMAC_KEY`       | Yes      | Base64url HMAC key.               |
| `CRYPTO_ENCRYPTION_KEY` | Yes      | Base64url AES-GCM encryption key. |

The server provides `NodeCrypto.layer` to `CryptoService.layer`. Consumers must
use a stable purpose from `cryptoPurpose`; do not encrypt, hash, or authenticate
values without domain separation. Ciphertext includes a version for future key
or format migration.

Do not log keys, plaintext credentials, decrypted payloads, HMACs, or ciphertext.
