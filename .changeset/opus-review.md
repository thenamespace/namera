---
"@namera-ai/contracts": minor
"@namera-ai/sdk": minor
---

Fixes from the Opus reviews of the Kernel-only contracts. Session-key signatures now bind the permission id: Smart
Sessions verifies `keccak256(abi.encode(userOpHash, permissionId))` for user operations and
`keccak256(abi.encode(hash, permissionId))` for ERC-1271, and the SDK's agent account signs those, so no one can move a
signed operation to another session of the same key. Reinstalling Smart Sessions spends every enable signature of the
earlier installation, even after a failed uninstall. Every Smart Sessions set holds at most 127 entries (ERC-7562), and
validator configs hold up to 2,304 bytes (16 passkeys or 69 ECDSA signers; `SessionKey` refuses more with
`TooManySigners`). `SpendPolicy` refuses two limits on one token and period; agents' stated times stay below 2^47 for
EntryPoint v0.9. `SessionHook` keeps its lock through the execution policies' `postCheck`, refuses reconfiguration and
calls to Smart Sessions during a session operation, and keys its transient slot by account.
