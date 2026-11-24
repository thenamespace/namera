---
"@namera-ai/contracts": minor
"@namera-ai/sdk": patch
---

Fixes from the rerun security review. Smart Sessions' fallback action (`Policy.anyCall`) refuses any module lifecycle
or hook function (`onInstall`, `onUninstall`, `preCheck`, `postCheck`) and calldata ending in the account's address:
through Safe7579's adapter, which reads the last 20 bytes as the sender, a fallback session could install a validator
on a Safe. A fallback call whose last argument is the account needs an explicit action. `Policy.spend` always counts
approvals of its token, even when `Policy.approvals` caps them (approve-then-pull no longer bypasses the budget), and
the pre-sign check mirrors the new fallback rule. A session that lists the same action twice is refused (`InvalidActionId`). The deploy pre-flight checks that `0x100` can't accept a forged P-256
signature.
