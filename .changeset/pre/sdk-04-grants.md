---
"@namera-ai/sdk": minor
---

Grants: a session the owner signed for an agent.

- `Grant.create`, `prepare` and `from`: the owner signs the session's EIP-712 `MultiChainSession` through the account,
  once per chain (Kernel binds the chain in its ERC-1271 domain), and nothing is sent. `install` and `installSync`
  enable it on chain now; otherwise the agent's first operation does.
- `Grant.verify` checks the session digests and the owner's signature (ERC-6492 for undeployed accounts).
  `serialize` and `parse` read and write canonical JSON or a compact `nmr1_` token, and `parse` refuses anything
  else, unknown fields included. `describe` lists what a grant allows.
- After a grant: `revoke`, `revokeSync` and `revokeCalls` remove an enabled session, or revoke an unused grant's
  enable signature, on one chain or every chain. `update`, `updateSync` and `updateCalls` add and remove policies in
  place and revoke the old enable signature. Reads need no key: `getStatus`, `getRemainingLimit`, `isEnabled`,
  `getUsage` (operations from the EntryPoint's logs), `list` and `watchStatus`.
- Failures are `GrantError` (`Malformed`, `VersionUnsupported`, `InvalidSignature`, `SignerMismatch`,
  `ChainNotCovered`, `DigestMismatch`, `PolicyNotFound`, `RemovalWidens`: removing a call policy while
  `Policy.anyCall` stays).
