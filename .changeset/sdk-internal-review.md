---
"@namera-ai/sdk": minor
---

Fixes from the internal security review. `Session.validate` requires `Policy.gas` on every session
(`GAS_LIMIT_REQUIRED`: the agent sets the fees, which the account pays without a paymaster) and refuses a policy contract
listed twice (`DUPLICATE_POLICY`); `SPONSORED_WITHOUT_GAS_LIMIT` is gone. `Policy.approvals` takes a cap per token
(`maxAmount: { [token]: cap }`). A lower bound on an integer narrower than 256 bits also caps the word at the type's
range. `Grant.update` refuses removing a call policy while `Policy.anyCall` stays (`GrantError` `RemovalWidens`). The
pre-sign check follows the contracts' new rules.
