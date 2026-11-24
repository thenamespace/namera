---
"@namera-ai/sdk": minor
---

Grants after they are made: `Grant.revoke` / `revokeSync` / `revokeCalls` (an enabled session is removed, an unused
grant's enable signature revoked, on one chain or every chain), `Grant.update` / `updateSync` / `updateCalls` (policies
added and removed in place, the old enable signature revoked), and reads without a key: `Grant.getStatus`,
`getRemainingLimit`, `isEnabled`, `getUsage` (operations from the EntryPoint's logs), `list` and `watchStatus`.
`GrantError` gains `PolicyNotFound`.
