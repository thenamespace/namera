---
"@namera-ai/contracts": minor
"@namera-ai/sdk": patch
---

Cheaper policies. Each policy stores a packed form of its configuration (the ABI configuration it takes is unchanged),
so a check reads fewer storage words: `ArgPolicy` costs about 59% less per call, `ApprovalPolicy` 34%, `SpendPolicy`
25%, `ValuePolicy` 15% and `RateLimitPolicy` 11%, and enabling a session costs 19–46% less per policy. A limit's
counter keeps only its latest period, so a new period rewrites its slot instead of filling a fresh one (`usage` reads 0
for an earlier period). Budgets are capped at 2^208 − 1 and periods at 48 bits; `ArgPolicy` offsets are below 2^232 − 1
besides `VALUE`, with at most 65,535 references. `WebAuthnValidator` compiles with 10,000 optimizer runs, so its
Solidity P-256 verifier costs about 31% less. Every policy's and `WebAuthnValidator`'s address changes. The SDK's
pre-sign check mirrors the budget cap.
