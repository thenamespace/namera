---
"@namera-ai/sdk": minor
---

Kernel 3.3 accounts as viem `SmartAccount`s: `KernelAccount.from`, and `KernelAccount.fromEip7702` for an EOA
delegated to Kernel, built on `SmartAccount.from`, which takes viem's `toSmartAccount` options.

- Owners are local keys, JSON-RPC wallets or passkeys (viem's `WebAuthnAccount`, through Namera's `WebAuthnValidator`):
  one, or `{ passkeys, threshold }` for up to 16 passkeys of which `threshold` sign each operation.
  `SmartAccount.signUserOperations` signs user operations on several chains with one prompt per passkey, prepared with
  `SmartAccount.getMultichainStubSignature`.
- New accounts install Smart Sessions and SessionHook in their deploying operation (`sessions`, default `true`), and
  deploy through ZeroDev's FactoryStaker, which is staked in the EntryPoint, so bundlers that enforce ERC-7562 accept
  the deploying operation.
- `SmartAccount.detect` reads whether an address holds a Kernel 3.3 account (deployed or through EIP-7702) and whether
  sessions are installed; any other account is `unsupported`. `SmartAccount.fromAddress` connects to Kernel accounts
  other SDKs created. `SmartAccount.installSessions`, `installSessionsSync`, `installSessionsCalls` and
  `isSessionsInstalled`.
- Owners after creation: `SmartAccount.getOwners`, and `addOwner`, `removeOwner`, `setThreshold`, `replaceOwner` and
  `addOwnerValidator`, each also as `…Calls` to batch and `…Sync` to wait.
- Failures are `AccountError` (`NotSupported`, `SessionsNotInstalled`, `SigningFailed`, `InvalidOptions`,
  `ChainMismatch`, `OwnerNotFound`, `OwnerExists`, `ThresholdUnreachable`, `OperationNotSupported`).
