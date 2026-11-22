---
"@namera-ai/contracts": minor
---

The launch policies: `AllowPolicy`, `ArgPolicy`, `ApprovalPolicy`, `SpendPolicy`, `ValuePolicy`, `RateLimitPolicy`,
`GasPolicy` and `SignaturePolicy`, each with its ABI and CREATE2 address (`SpendPolicy.v1`, …).

`SignaturePolicy` restricts what a session key signs with ERC-1271 down to single fields of the typed data (a permit's
spender and value): Smart Sessions now passes the signed struct's EIP-712 data, checked against the signed hash, to
policies implementing `I1271TypedDataPolicy`, which changes the session signature layout and SmartSession's address.
