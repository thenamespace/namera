---
"@namera-ai/sdk": minor
---

Owners after creation: `SmartAccount.getOwners` reads an account's key owner and passkeys with their threshold, and
`addOwner`, `removeOwner`, `setThreshold`, `replaceOwner` and `addOwnerValidator` change them (each also as `…Calls`
to batch and `…Sync` to wait). Kernel's ECDSA validator holds one key, which `replaceOwner` rotates.
`SmartAccount.fromAddress` signs with an owner validator installed next to Kernel's root.

`AccountError` gains `OwnerNotFound`, `OwnerExists`, `ThresholdUnreachable` and `OperationNotSupported`.
