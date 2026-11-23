---
"@namera-ai/sdk": minor
---

Passkey owners on every account, through Namera's `WebAuthnValidator`.

- `KernelAccount.from`, `NexusAccount.from` and `Safe7579Account.from` take a passkey (viem's `WebAuthnAccount`) as
  owner, or `{ passkeys, threshold }` for up to 16 passkeys of which `threshold` sign each operation; so does
  `SmartAccount.fromAddress`. Passkeys verify with the P-256 precompile where the chain has one, and their ERC-1271
  signatures are bound to the account and chain.
- `SmartAccount.signUserOperations` signs user operations on several chains with one prompt per passkey, and
  `SmartAccount.getMultichainStubSignature` prepares them for it.
