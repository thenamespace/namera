---
"@namera-ai/sdk": patch
---

The SDK depends on the exact `ox` its viem depends on (`ox@0.14.67` for viem 2.58), instead of `ox@^1.8`, so an app
bundles one ox and one `@noble/*` instead of two: the SDK's share of an app with viem bundled drops by 20 to 37 KB gzip
(an agent 64.8 → 42.5 KB, an owner 56.4 → 36.5 KB, the whole SDK 119.1 → 82.3 KB). Upgrade viem and the SDK together
to keep them on one ox. Nothing else changes: addresses the SDK decodes (spend-limit violations and usage, revert
arguments, the account's ECDSA owner) are still checksummed, `encryptedJson` exports written before open unchanged,
and `Policy.ArgumentConditions` takes the same parameter type (`AbiParameters.Parameter`, abitype's `AbiParameter`).
