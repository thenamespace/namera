---
"@namera-ai/sdk": minor
---

Accounts built with `sessions` (the default), and `SmartAccount.installSessions`, install SessionHook with Smart
Sessions, so sessions can carry execution policies: bound to Smart Sessions on Kernel (whose session operations then run
through `executeUserOp`), as the account's hook on Nexus and Safe7579. `SmartAccount.isSessionsInstalled` requires
both.
