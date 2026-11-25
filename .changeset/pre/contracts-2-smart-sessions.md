---
"@namera-ai/contracts": minor
---

`SmartSession`, Namera's fork of Rhinestone and Biconomy's Smart Sessions (AGPL-3.0, see its `NOTICE.md`), with
`ECDSASessionValidator` (k-of-n session signers) and `WebAuthnValidator`. Smart Sessions installs on Kernel 3.3
(EntryPoint 0.7, deployed or through EIP-7702) only, and refuses any account whose `accountId()` isn't
`kernel.advanced.v0.3.3` (`UnsupportedAccount`).

- Sessions carry an owner-signed validity window (`validAfter`, `validUntil`). Session-key signatures bind the
  permission id (`keccak256(abi.encode(userOpHash, permissionId))`, and the same for ERC-1271 hashes), so a signed
  operation can't be moved to another session of the same key.
- ERC-1271 session signatures (ERC-7739, over Kernel's wrapped hash) carry the signed struct's EIP-712 data, checked
  against the hash, for policies implementing `I1271TypedDataPolicy`.
- Removing a session, every reconfiguration, and uninstalling or reinstalling the module spend unused enable
  signatures (`getNonce` is `epoch ‖ counter`). A session enabled in ENABLE mode emits `NonceIterated` and
  `SessionCreated`.
- The fallback action (any call) never reaches the account, Smart Sessions, the EntryPoint or the account's installed
  validators and executors. It also refuses module lifecycle and hook functions (`onInstall`, `onUninstall`,
  `preCheck`, `postCheck`) on any target, and calldata ending in the account's or the EntryPoint's address.
- Also refused: a policy or an action listed twice, calldata of 1 to 3 bytes or starting with the value selector, a
  policy answer that isn't exactly one word, an account asking about itself, and high-s ECDSA session signatures.
  Every set holds at most 127 entries (ERC-7562), and a validator config up to 2,304 bytes (16 passkeys or 69 ECDSA
  signers).
- `WebAuthnValidator` is Namera's ERC-7579 validator for passkey owners on Kernel, and the stateless passkey verifier
  for session keys. An account holds up to 16 passkeys with a threshold (`addPasskey`, `removePasskey`,
  `setThreshold`). ERC-1271 signatures are bound to the account and chain (`replaySafeHash`), and a multichain mode
  lets one assertion approve user operations on several chains (`multichainChallenge`). P-256 is verified through
  the RIP-7212 / EIP-7951 precompile or in Solidity, as the signer chooses.
