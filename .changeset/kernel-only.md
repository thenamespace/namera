---
"@namera-ai/sdk": major
"@namera-ai/contracts": minor
---

Kernel 3.3 on EntryPoint 0.7, deployed or through EIP-7702, is the only account Namera supports.

- `NexusAccount` and `Safe7579Account` are removed, with their Effect forms. `SmartAccount.detect` reports any account
  but Kernel 3.3 as `unsupported`, and the `SmartAccount` operations, `AccountError`'s account type and a grant's
  `accountType` name Kernel only; `Grant.parse` refuses a grant for another account (`Malformed`).
- `Grant.create` signs once per chain, and an agent has 2^16 nonce lanes.
- Smart Sessions and SessionHook refuse to install on any other account (`UnsupportedAccount`): the account's
  `accountId()` must be `"kernel.advanced.v0.3.3"`.
- `SessionHook`'s install data is `abi.encode(address smartSession)`, with no account flavour; `getInstall` becomes
  `getSmartSession(account)`, and `SessionHookInstalled` carries the account and the Smart Sessions module.
- Smart Sessions' fallback action also refuses calldata ending in EntryPoint 0.7's or 0.8's address, as it does the
  account's.
- `ApprovalPolicy` refuses a zero token or a token capped twice (`InvalidCap`), and `Policy.approvals` never compiles
  either: the zero token is refused (`INVALID_ADDRESS`), a token listed twice in any case is capped once, and a
  per-token `maxAmount` that caps one token twice is refused (`INVALID_AMOUNT`).
- Enabling a session in ENABLE mode emits `NonceIterated` and `SessionCreated`.
- `External` lists EntryPoint 0.7 and Kernel 3.3 only. Every Namera contract's address changes, and no deployment is
  recorded yet.
