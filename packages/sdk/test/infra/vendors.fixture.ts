// Vendor answers captured by Namera's live compatibility runs on Base Sepolia (2026-11-15), copied verbatim from
// `research/scratchpad/compat-e2e/results/*.json` and `compat-check/results/bundlers.json`. Revert data naming a
// policy uses Namera's deployed policy addresses where the run used Rhinestone's.

/** `pimlico_getUserOperationGasPrice` on Ethereum. */
export const pimlicoGasPrice = {
  slow: { maxFeePerGas: "0x1374c45f", maxPriorityFeePerGas: "0x225c147" },
  standard: { maxFeePerGas: "0x146dce30", maxPriorityFeePerGas: "0x2413e24" },
  fast: { maxFeePerGas: "0x1566d802", maxPriorityFeePerGas: "0x25cbb01" }
}

/** `voltaire_feesPerGas` on Ethereum. */
export const candideFees = { maxFeePerGas: "0xebd30b0", maxPriorityFeePerGas: "0x4d4c" }

/** `skandha_getGasPrice` on Ethereum. */
export const etherspotGasPrice = { maxPriorityFeePerGas: "0x406a", maxFeePerGas: "0xebd23cd" }

/** Pimlico's paymaster through Candide's bundler: the revert data as a Python bytes literal. */
export const candideBundlerNotAllowed = String
  .raw`AA33 revertedb'U\xd3\xabF<\xfd\xc2\x12v\x9c\x89\t\x07\xbc\xe9==\x8c,S\xdejz\x89'`

/** Pimlico's paymaster through Etherspot's bundler, which simulates with `tx.origin = 0`. */
export const etherspotBundlerNotAllowed =
  `FailedOpWithRevert(0,"AA33 reverted",0x55d3ab460000000000000000000000000000000000000000000000000000000000000000)`

/**
 * Alchemy's Gas Manager through Candide's bundler (Base Sepolia, 2026-11-25): its paymaster reverts
 * `SenderNotAllowed(address)` naming Candide's executor.
 */
export const candideSenderNotAllowed =
  "AA33 reverted: unknown revert (selector 0xd0d25976): 0xd0d259760000000000000000000000003cfdc212769c890907bce93d3d8c2c53de6a7a89"

/** Pimlico's paymaster through Alchemy's bundler: no revert data. */
export const alchemyAa33 = "validation reverted: [reason]: AA33 reverted"

/** A session's revert as alto reports it, for a session's permission id and a policy address. */
export const altoPolicyViolation = (policy: string) =>
  `UserOperation reverted during simulation with reason: AA23 reverted 0x3b577361a5321714a13bf492bd6772935fcc09473956f8f5930c12c71912f5c58034bfea000000000000000000000000${
    policy.slice(2).toLowerCase()
  }`

/** An action no policy allows (`NoPoliciesSet`), as Alchemy reports it. */
export const alchemyNoPoliciesSet =
  "AA23 reverted: unknown revert (selector 0x1c792c05): 0x1c792c05a4b276562698f1d2050212b55bf1ca1ce21cd287524b0e12d35229a148a418fe"

/** A paymaster on a session that doesn't allow one (`PaymasterValidationNotEnabled`). */
export const paymasterNotEnabled =
  "UserOperation reverted during simulation with reason: AA23 reverted 0xd5dc9fa4d780631ec37467d2befe1b053c6d0fd07164d210318b0d590b385926f156f3ba"

/** A removed session (`InvalidPermissionId`), with the revert data as JSON. */
export const revokedSession =
  `validation reverted: [reason]: AA23 reverted {"reason":"AA23 reverted","revertData":"0x526d0da5108e5bf05bf1feef10277a1a9e76f15c32196f7aae3803aca78b66ecbced7954"}`

/** A replayed enable signature (`HashMismatch`). */
export const replayedEnable =
  "UserOperation reverted during simulation with reason: AA23 reverted 0x0b08d5be4a0c426ee4bebb8ba278fad3adb008d720af0b77c993fe1554541963b3274e0a4d800ddd2ccaaa374c4029fe5d2c98df84919f00f2c197978eda25f0f6aa9605"

/** An expired session. */
export const expired = "UserOperation reverted with reason: AA22 expired or not due"

/** Candide's paymaster refusing a Kernel owner transfer through Pimlico's bundler (Base Sepolia, 2026-11-25). */
export const candideCallGasTooLow =
  "validator: UserOp's callGasLimit is lower than the minimum allowed gas limit for this UserOp of 0x86fd"

/** Pimlico sponsorship with an inactive policy. */
export const policyInactive = "sponsorshipPolicy not active"

/** Candide sponsorship with an unfunded policy. */
export const candideUnfunded =
  "sponsored-validator: The policy's billing account balance is below the user operation's max cost (insufficient_balance)"

/** Pimlico's ERC-20 paymaster for an account without USDC. */
export const pimlicoErc20Unfunded =
  "AA50 PostOp Reverted: Insufficient balance, 0.006121 USDC required but sender has 0 USDC"

/** Pimlico's public endpoint asked to sponsor without a policy. */
export const policyRequired = "Sponsorship policy ID is required for this API key"

/** Candide's paymaster refusing Alchemy's call gas estimate. */
export const candideMinCallGas =
  "validator: UserOp's callGasLimit is lower than the minimum allowed gas limit for this UserOp of 0x4603"

/** Arka asked for an ERC-20 token it doesn't support. */
export const arkaUnsupportedToken = "Unsupported token"

/** Etherspot's EntryPoint 0.7 endpoint given an EIP-7702 authorization. */
export const etherspot7702 = "EIP7702 is not supported in this network"

/** Candide's public endpoint asked for a method it doesn't serve. */
export const candideUnsupportedMethod = "Unsupported method - eth_maxPriorityFeePerGas not supported"
