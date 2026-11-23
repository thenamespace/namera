---
"@namera-ai/sdk": minor
---

Owners after creation: `SmartAccount.getOwners` reads an account's key owners and passkeys with their thresholds, and
`addOwner`, `removeOwner`, `setThreshold`, `replaceOwner` and `addOwnerValidator` change them on Kernel, Nexus and
Safe7579 (each also as `…Calls` to batch and `…Sync` to wait). A Safe7579 account's keys change on OwnableValidator and
on the Safe together. `SmartAccount.fromAddress` signs with an owner validator installed next to Kernel's root.

`AccountError` gains `OwnerNotFound`, `OwnerExists`, `ThresholdUnreachable` and `OperationNotSupported`, and a
bundler refusing to deploy an account through an unstaked factory gets a hint.
