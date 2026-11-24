---
"@namera-ai/sdk": minor
---

Smart accounts as viem `SmartAccount`s: `SmartAccount.from` builds one from viem's `toSmartAccount` options with
Namera's errors, and `KernelAccount` (Kernel 3.3 on EntryPoint 0.7) is built on it, with `from`, and `fromEip7702` for
an EOA delegated to Kernel.

- Owners are local keys or JSON-RPC wallets.
- New accounts install Smart Sessions in their deploying operation (`sessions`, default `true`).
- Kernel accounts deploy through ZeroDev's FactoryStaker, which is staked in the EntryPoint, so bundlers that enforce
  ERC-7562 accept the deploying operation.
- `SmartAccount.detect` reads whether an address holds a Kernel 3.3 account (deployed or through EIP-7702) and
  whether Smart Sessions is installed; `SmartAccount.fromAddress` connects to Kernel accounts other SDKs created.
- `SmartAccount.installSessions`, `installSessionsSync`, `installSessionsCalls` and `isSessionsInstalled`.
- `AccountError` (`NotSupported`, `SessionsNotInstalled`, `SigningFailed`, `InvalidOptions`, `ChainMismatch`).
- Errors name where they happened and end with a hint: `ChainError` has `method`, `chainId` and `url` (without
  credentials), and every reason a "what to do" line in `metaMessages`.
