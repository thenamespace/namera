---
"@namera-ai/sdk": minor
---

Policies and sessions. `Policy.*` builders cover calls with conditions inferred from the ABI (`call`,
`erc20Transfer`, `erc20Approve`, `nativeTransfer`, `anyCall`), spend, value, rate and gas limits, `approvals` with a
cap per token, typed-data signing with field conditions, execution policies and custom policies. `Session.from`,
`Session.expiresIn`, `Session.validate` (every problem with a stable code), `Session.describe`,
`Session.getPermissionId` and `Session.toSmartSession`, which compiles a session to Namera's contracts. Failures are
`SessionError` (`InvalidSession`).

- Every session needs `Policy.gas` (`GAS_LIMIT_REQUIRED`): the agent sets the fees, which the account pays without a
  paymaster.
- `Policy.spend` always counts approvals of its token, so approving then pulling can't bypass the budget.
- A lower bound on an integer narrower than 256 bits also caps the word at the type's range.
- `Session.validate` refuses a policy listed twice (`DUPLICATE_POLICY`). Given `paymaster` and `chainId`, it warns
  `SESSION_PERMIT_REQUIRED` for Circle's paymaster without a permit policy.
