---
"@namera-ai/sdk": minor
---

Smart accounts as viem `SmartAccount`s: `SmartAccount.from` builds one from viem's `toSmartAccount` options with
Namera's errors, and `KernelAccount` (Kernel 3.3), `NexusAccount` (Nexus 1.3.3) and `Safe7579Account` (Safe 1.4.1 with
Safe7579 v2) are built on it, each with `from`, and `fromEip7702` for Kernel and Nexus.

- Owners are local keys or JSON-RPC wallets; Safe7579 takes several owners and a threshold.
- New accounts install Smart Sessions in their deploying operation (`sessions`, default `true`).
- Kernel accounts deploy through ZeroDev's FactoryStaker, which is staked in the EntryPoint, so bundlers that enforce
  ERC-7562 accept the deploying operation. The Nexus 1.3.3 and Safe proxy factories are unstaked on every chain: such
  bundlers refuse to deploy those accounts in a user operation (lenient ones accept it), so send the factory call as
  a transaction first there.
- `SmartAccount.detect` reads which supported account an address holds, its version and whether Smart Sessions is
  installed; `SmartAccount.fromAddress` connects to accounts other SDKs created.
- `SmartAccount.installSessions`, `installSessionsSync`, `installSessionsCalls` and `isSessionsInstalled`.
- `AccountError` (`NotSupported`, `SessionsNotInstalled`, `SigningFailed`, `InvalidOptions`, `ChainMismatch`).
- Errors name where they happened and end with a hint: `ChainError` has `method`, `chainId` and `url` (without
  credentials), and every reason a "what to do" line in `metaMessages`.
