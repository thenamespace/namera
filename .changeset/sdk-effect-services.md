---
"@namera-ai/sdk": minor
---

The Effect API's `Keystore.CurrentKeystore` service carries a program's key store through its context, provided by
`Keystore.layer(store)`, `Keystore.layerMemory` and `Keystore.layerEncryptedJson(options)`, and by
`Keystore.layerFile` and `Keystore.layerOsKeychain` in `@namera-ai/sdk/effect/node` and `Keystore.layerWebCrypto` in
`@namera-ai/sdk/effect/browser`. Where an API accepts both a store option and the service, the service in context
wins.
