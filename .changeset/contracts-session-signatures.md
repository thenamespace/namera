---
"@namera-ai/contracts": minor
---

Smart Sessions verifies session-key ERC-1271 signatures on Kernel (which wraps the hash it asks validators about) and
on Safe7579 (which has no EIP-712 domain of its own). Namera's limit policies gain a `usage` view: what an account has
used of a budget in a period. Smart Sessions' and the limit policies' addresses change.
