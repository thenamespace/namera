---
"@namera-ai/contracts": minor
---

`SessionHook`: execution policies for sessions, which run around a session operation's calls and can check what it
did. A session lists up to 8 execution policies (contracts implementing `IExecutionPolicy`) in `SessionHook`'s user
operation policy data, so the owner's signature covers them. Kernel binds the hook to Smart Sessions' validation
(install data `abi.encode(address smartSession)`, read back with `getSmartSession(account)`) and runs session
operations through `executeUserOp`; a session operation names its session in a tag at the end of its calldata.

The hook refuses a different reinstall, install or uninstall during a session operation, and session calls to the
hook, the account, Smart Sessions, the EntryPoint or the session's execution policies, and it holds its lock through
the policies' `postCheck`. `ExecutionPolicyBase` (Solidity source) is a starting point for writing execution
policies.
