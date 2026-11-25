---
"@namera-ai/sdk": minor
---

Keys and session keys for agents.

- `Key`: a key's public half, with its addresses per chain namespace (`Key.address`, `Key.caip10`; `eip155` now,
  `tron` and `solana` reserved).
- `Keystore`: stores that hold keys by curve (secp256k1, ed25519, p256) and sign inside the store. `memory`,
  `encryptedJson` (exported with `toJson`) and `from` (your own backend) work everywhere; `Keystore.file` and
  `Keystore.osKeychain` (with the optional peer `@napi-rs/keyring`) are in `@namera-ai/sdk/node`, and
  `Keystore.webCrypto` in `@namera-ai/sdk/browser`. `Keystore.toAccount` turns a secp256k1 key into a viem account.
- The Effect API's `Keystore.CurrentKeystore` service carries a key store through a program's context:
  `Keystore.layer(store)`, `layerMemory` and `layerEncryptedJson(options)`, with `layerFile` and `layerOsKeychain` in
  `@namera-ai/sdk/effect/node` and `layerWebCrypto` in `@namera-ai/sdk/effect/browser`. Where an API takes both a
  store option and the service, the service wins.
- `SessionKey.ecdsa` and `SessionKey.ecdsaThreshold` (up to 69 signers), checked by `ECDSASessionValidator`, and
  `SessionKey.passkey` and `SessionKey.passkeyThreshold` (up to 16 passkeys), checked by `WebAuthnValidator` from the
  session's own config; `SessionKey.toValidatorData`.
- Failures are `KeystoreError` and `SessionKeyError`.
