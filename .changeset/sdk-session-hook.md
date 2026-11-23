---
"@namera-ai/sdk": minor
---

Accounts built with `sessions` (the default), and `SmartAccount.installSessions`, install SessionHook with Smart
Sessions, so sessions can carry execution policies: bound to Smart Sessions on Kernel (whose session operations then run
through `executeUserOp`), as the account's hook on Nexus and Safe7579. `SmartAccount.isSessionsInstalled` requires
both.

`SmartAccount.installSessions` fails with `AccountError` (`OperationNotSupported`) before sending when a Nexus or
Safe7579 account already has another hook, since those accounts run one global hook.
