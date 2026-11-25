---
"@namera-ai/sdk": minor
---

Bundlers, paymasters and combinations, as viem configuration. `Bundler.pimlico`, `alchemy` (with Alchemy's bundler
sponsorship), `candide`, `zerodev` (with UltraRelay), `etherspot` and `from` return `{ transport, userOperation }` for
`createBundlerClient`: the vendor's endpoint for the client's chain, fees from the vendor's own method, and its
estimate quirks. `Paymaster.pimlico`, `pimlicoErc20`, `alchemy`, `candide`, `zerodev`, `etherspot`, `circle` and
`erc7677` return viem paymasters: stub requests with zeroed gas, missing paymaster gas filled in, signed fields never
changed, and Circle's USDC permit signed by the account (the owner, or an agent's session key under a
`Policy.signTypedData`).

`Compat.check` and `Compat.matrix` hold the combination rules from Namera's live tests on Base Sepolia and Sepolia
(`PAYMASTER_BUNDLER_BOUND`, `PAYMASTER_AGENT_UNSUPPORTED`, `SPONSORSHIP_BUNDLER_BOUND`, `EIP7702_UNSUPPORTED`,
`SLOW_INCLUSION`, `SESSION_PERMIT_REQUIRED`, `NOT_ON_CHAIN`), and the bundler helpers refuse a combination that can't
work with `CompatError` before signing (`strict: false` sends anyway). `NameraError.decode` turns bundler and
paymaster failures into `PolicyViolationError`, `BundlerError` (`Rejected`, `Unsupported`, `Dropped`),
`PaymasterError` (`Rejected`, `PolicyInactive`, `InsufficientBalance`, `BundlerBound`) and `CompatError`
(`Incompatible`), with API keys kept out of every error.
