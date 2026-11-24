---
"@namera-ai/sdk": minor
---

`Grant.toAccount`: the agent's viem smart account under a grant. It sends user operations through viem's bundler client
(the first enables the session, and deploys the account when its factory allows it) and signs typed data with ERC-7739
session signatures, on parallel nonce lanes. Before the session key signs, each operation
and signature is checked against the session's policies with the limits' usage read from the chain, refusing with the
new `PolicyViolationError`. `Grant.check` runs the same check without a key. `GrantError` gains `SignerMismatch`.
