---
"@namera-ai/sdk": minor
---

Accounts built with `sessions` (the default), and `SmartAccount.installSessions`, install SessionHook with Smart
Sessions, so sessions can carry execution policies: SessionHook is bound to Smart Sessions' validation on Kernel, whose
session operations then run through `executeUserOp`. `SmartAccount.isSessionsInstalled` requires both.
