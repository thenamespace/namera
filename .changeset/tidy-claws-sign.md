---
"@namera-ai/api": minor
"@namera-ai/protocol": minor
"@namera-ai/sdk": minor
"@namera-ai/cli": minor
---

Add 1Claw-managed smart-account owners and session keys, including custody-aware creation, owner approvals, execution, and signing. Support local and managed session keys with either passkey-owned or 1Claw-managed accounts.

Use the same SDK execution and signing methods, CLI commands, and MCP tools for both session-key custody types. Managed session keys require no local key import or signer resolver; local keys continue signing on the client. Add public custody and signing-method schemas and fix managed smart-account signature verification.

For self-funded managed executions, configure `maxGasCostWei` on `NameraClient`. Managed signature completion is not automatically retried: retrying a lost result with a new signing request may consume another signature allowance.
