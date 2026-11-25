---
"@namera-ai/sdk": minor
---

`Grant.toAccount`: the agent's viem smart account under a grant. It sends user operations through viem's bundler
client on 2^16 parallel nonce lanes (the first enables the session, and deploys the account when its factory allows
it), and signs typed data with ERC-7739 session signatures bound to the session's permission id. Before the session
key signs, each operation and signature is checked against the session's policies, with the limits' usage read from
the chain, and a breach is refused with `PolicyViolationError` (`CallNotAllowed`, `ArgumentRejected`,
`SpendLimitExceeded`, `SessionRevoked`, …). `Grant.check` runs the same check without a key.
