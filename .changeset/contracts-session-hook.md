---
"@namera-ai/contracts": minor
---

`SessionHook`: execution policies for sessions. A session lists its execution policies (contracts implementing
`IExecutionPolicy`) in `SessionHook`'s user operation policy data, so the owner's signature covers them; the hook runs
their `preCheck` before the session operation's calls and `postCheck` after, on Kernel, Nexus and Safe7579. A session
operation names its session in a tag at the end of its calldata. `ExecutionPolicyBase` (source) is a starting point for
applications writing policies.

Smart Sessions validates the `execute` inside Kernel's `executeUserOp` and rejects another session's tag; Namera's
policies read the wrapped `execute` and the time before the tag. Smart Sessions' and the policies' addresses change.
