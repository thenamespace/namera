---
"@namera-ai/protocol": minor
"@namera-ai/api": minor
"@namera-ai/sdk": minor
"@namera-ai/cli": minor
---

Replace the pre-launch session creation payload's shared onchain configuration
with `onchain.installations`. Each entry supplies `chainId`, `validAfter`,
`validUntil`, `permissions`, and optional `allowSignatures`. Session-level API
`policies` remain separate. The old request shape is no longer accepted.

Registration verification now matches each response installation to the reviewed
configuration for its chain, including its permissions, dates and signature flag.
Existing stored sessions, encrypted exports and local signing bindings remain
compatible. SDK list/get and CLI commands are unchanged; the four packages release
together in the existing fixed version group.
