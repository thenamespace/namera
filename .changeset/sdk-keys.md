---
"@namera-ai/sdk": minor
---

Keys and session keys for agents.

- `Key`: a key's public half with its addresses per chain namespace (`Key.address`, `Key.caip10`; `eip155` now,
  `tron` and `solana` reserved).
- `Keystore`: stores that hold keys by curve (secp256k1, ed25519, p256) and sign inside the store. `memory`,
  `encryptedJson` (exported with `toJson`) and `from` (your own backend) everywhere; `Keystore.file` and
  `Keystore.osKeychain` in `@namera-ai/sdk/node`; `Keystore.webCrypto` in `@namera-ai/sdk/browser`.
  `Keystore.toAccount` turns a secp256k1 key into a viem account.
- `SessionKey.ecdsa` and `SessionKey.ecdsaThreshold`: the agent's signer as `ECDSASessionValidator` checks it, and
  `SessionKey.toValidatorData`.
- `KeystoreError` and `SessionKeyError`, Effect v4 error families with hints.
- `@napi-rs/keyring` is an optional peer dependency, for `Keystore.osKeychain`.
