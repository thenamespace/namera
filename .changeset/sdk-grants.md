---
"@namera-ai/sdk": minor
---

Grants: `Grant.create`, `prepare` and `from` (the owner signs the session's EIP-712 `MultiChainSession` through the
account, once or once per chain as the account's ERC-1271 requires; nothing is sent), `install` and `installSync`
(enable on chain now), `verify` (session digests and the owner's signature, ERC-6492 for undeployed accounts),
`serialize` and `parse` (canonical JSON or a compact `nmr1_` token) and `describe`. Failures are `GrantError`
(`Malformed`, `VersionUnsupported`, `InvalidSignature`, `ChainNotCovered`, `DigestMismatch`).
