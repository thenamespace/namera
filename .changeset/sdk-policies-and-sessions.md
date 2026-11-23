---
"@namera-ai/sdk": minor
---

Policies and sessions: `Policy.*` builders (calls with conditions inferred from the ABI, spend, value, rate and gas
limits, approvals, typed-data signing with field conditions, execution policies, custom policies), `Session.from`,
`Session.validate` (every problem with a stable code), `Session.describe`, `Session.getPermissionId` and
`Session.toSmartSession`, which compiles a session to Namera's Smart Sessions and policy contracts. Failures are
`SessionError` (`InvalidSession`).
