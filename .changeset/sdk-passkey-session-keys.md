---
"@namera-ai/sdk": minor
---

`SessionKey.passkey` and `SessionKey.passkeyThreshold` make passkey session keys, checked by `WebAuthnValidator` from
the session's own config (nothing is installed on the account). `SessionKey.SessionKey` is now `Ecdsa | Passkey`, and
`SessionKeyError` gains the `InvalidPublicKey` reason.
