---
"@namera-ai/contracts": minor
---

Fixes from the internal security review. Smart Sessions' fallback action no longer reaches the account's
infrastructure (the EntryPoint, its installed validators, executors and hooks, Nexus's default validator); every
reconfiguration spends the session's enable nonce, and uninstalling spends every unused enable signature (`getNonce` is
now `epoch ‖ counter`); a policy listed twice, calldata of 1 to 3 bytes or starting with the value selector, a policy
answer longer than one word and an account asking about itself are refused. `SessionHook` refuses a different
reinstall, and install or uninstall during a session operation. `SpendPolicy` counts Permit2 approvals and refuses
other functions of a limited token. `ApprovalPolicy` takes a cap per token (`(address[] spenders, (address token,
uint256 maxAmount)[] caps)`), checks the target and value, and refuses `increaseAllowance`. `ECDSASessionValidator`
refuses high-s signatures. Contracts compile with the IR pipeline; every address changes.
