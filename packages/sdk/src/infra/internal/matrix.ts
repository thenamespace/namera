import * as SmartSession from "@namera-ai/contracts/SmartSession"

import { circleChains } from "../../internal/core/circle.ts"
import { networks } from "./vendors/alchemy.ts"

// What Namera knows about each bundler and paymaster with its account (Kernel 3.3 on EntryPoint 0.7, deployed or
// through EIP-7702), from its live tests. `Compat.check` evaluates these entries; the live suite
// (`test/live`, `NAMERA_LIVE=1`) fails when one stops matching what the vendors do, and every entry names its
// evidence and date.

/**
 * A bundler vendor: the five Namera tests live, and `custom` for any other endpoint (`Bundler.from`).
 */
export type BundlerVendor = "pimlico" | "alchemy" | "candide" | "zerodev" | "etherspot" | "custom"

/**
 * A paymaster vendor, as `Paymaster.*` tags its result: `erc7677` is any other ERC-7677 paymaster.
 */
export type PaymasterVendor =
  | "pimlico"
  | "pimlico-erc20"
  | "alchemy"
  | "candide"
  | "zerodev"
  | "etherspot"
  | "circle"
  | "erc7677"

/**
 * A bundler that sponsors operations itself, without a paymaster: Alchemy's bundler sponsorship (BSO) and ZeroDev's
 * UltraRelay.
 */
export type Sponsorship = "alchemy-bso" | "ultra-relay"

/**
 * Where an entry comes from and when it was last seen true.
 */
export interface Evidence {
  readonly source: string
  readonly date: string
}

/** A bundler: its fee method, the chains it has an endpoint on, EIP-7702 support and inclusion time. */
export interface BundlerEntry extends Evidence {
  readonly vendor: BundlerVendor
  /** The vendor's method the helper reads fees from. */
  readonly fees: string
  /** The chains the helper has an endpoint for: `any` when the URL takes the chain id. */
  readonly chains: ReadonlyArray<number> | "any"
  /** Whether it accepts an EIP-7702 authorization with an EntryPoint 0.7 operation. */
  readonly eip7702: boolean
  /** Median and slowest inclusion seen, in seconds. */
  readonly inclusion?: { readonly median: number; readonly max: number } | undefined
}

/** A paymaster or a bundler's own sponsorship: the bundlers and chains it works with. */
export interface PaymasterEntry extends Evidence {
  readonly vendor: PaymasterVendor | Sponsorship
  /** The bundlers it works with: `any`, or the only ones it accepts. */
  readonly bundlers: ReadonlyArray<BundlerVendor> | "any"
  /** The chains it is on: `any` when the vendor's URL takes the chain id. */
  readonly chains: ReadonlyArray<number> | "any"
  /** Bundlers it refuses on one chain only, where `bundlers` allows them elsewhere. */
  readonly refusedBy?: ReadonlyArray<{ readonly bundler: BundlerVendor; readonly chainId: number }> | undefined
  /** `false` when it refuses agents' operations (Smart Sessions), though it sponsors the owner's. */
  readonly agents?: boolean | undefined
  readonly note?: string | undefined
}

/** A rule `Compat.check` applies: its code, whether it fails (`problem`) or informs (`warning`), and what it says. */
export interface RuleEntry extends Evidence {
  readonly code:
    | "PAYMASTER_BUNDLER_BOUND"
    | "PAYMASTER_AGENT_UNSUPPORTED"
    | "SPONSORSHIP_BUNDLER_BOUND"
    | "EIP7702_UNSUPPORTED"
    | "SLOW_INCLUSION"
    | "SESSION_PERMIT_REQUIRED"
    | "NOT_ON_CHAIN"
  readonly severity: "problem" | "warning"
  readonly rule: string
}

/** The compatibility data, versioned by the date of its newest evidence. */
export interface Matrix {
  /** The date of the newest evidence: the matrix's version. */
  readonly version: string
  readonly entryPoint: "0.7"
  readonly account: { readonly type: "kernel"; readonly version: "3.3"; readonly sessionChains: ReadonlyArray<number> }
  readonly bundlers: ReadonlyArray<BundlerEntry>
  readonly paymasters: ReadonlyArray<PaymasterEntry>
  readonly rules: ReadonlyArray<RuleEntry>
}

const run1 = { source: "Namera live tests, Base Sepolia (owner operations, 60 of 60)", date: "2026-11-15" }
const run2 = { source: "Namera live tests, Base Sepolia (paymaster × bundler, run 2)", date: "2026-11-15" }
const run3 = { source: "Namera live matrix, Base Sepolia and Sepolia (208 cells)", date: "2026-11-25" }
const scan = { source: "eth_getCode scan of Circle's paymasters, and Circle's published addresses", date: "2026-11-15" }

const alchemyChains = Object.keys(networks).map(Number)

/**
 * The compatibility matrix.
 *
 * @internal
 */
export const matrix: Matrix = {
  version: "2026-11-25",
  entryPoint: "0.7",
  account: {
    type: "kernel",
    version: "3.3",
    sessionChains: Object.keys(SmartSession.deploymentsV1).map(Number)
  },
  bundlers: [
    {
      vendor: "pimlico",
      fees: "pimlico_getUserOperationGasPrice",
      chains: "any",
      eip7702: true,
      inclusion: { median: 0, max: 3 },
      ...run1
    },
    {
      vendor: "alchemy",
      fees: "rundler_maxPriorityFeePerGas",
      chains: alchemyChains,
      eip7702: true,
      inclusion: { median: 0, max: 3 },
      ...run1
    },
    {
      vendor: "candide",
      fees: "voltaire_feesPerGas",
      chains: "any",
      eip7702: true,
      inclusion: { median: 3, max: 7 },
      ...run1
    },
    {
      vendor: "zerodev",
      fees: "zd_getUserOperationGasPrice",
      chains: "any",
      eip7702: true,
      inclusion: { median: 3, max: 3 },
      ...run1
    },
    {
      vendor: "etherspot",
      fees: "skandha_getGasPrice",
      chains: "any",
      eip7702: false,
      inclusion: { median: 95, max: 132 },
      ...run1
    },
    {
      vendor: "custom",
      fees: "eth_feeHistory (the node)",
      chains: "any",
      eip7702: true,
      source: "not tested: any bundler URL",
      date: "2026-11-25"
    }
  ],
  paymasters: [
    {
      vendor: "circle",
      bundlers: "any",
      // Circle's Sepolia paymaster has no EntryPoint deposit or stake (AA31/AA33 on every bundler).
      chains: Object.keys(circleChains).map(Number).filter((chainId) => chainId !== 11155111),
      note: "USDC permit signed by the account; no API",
      ...run3
    },
    {
      vendor: "alchemy",
      bundlers: "any",
      chains: alchemyChains,
      // `SenderNotAllowed` for Candide's executor on Base Sepolia; Candide's bundler works on Sepolia.
      refusedBy: [{ bundler: "candide", chainId: 84532 }],
      note: "Gas Manager, onchain paymaster policy",
      ...run3
    },
    {
      vendor: "etherspot",
      bundlers: "any",
      chains: "any",
      // Arka's stub runs Skandha's estimate, which reverts for a Smart Sessions signature.
      agents: false,
      note: "Arka, verifying paymaster; owner operations only",
      ...run3
    },
    {
      vendor: "candide",
      bundlers: "any",
      chains: "any",
      note: "needs a minimum call gas it computes per operation (the helper floors 30k, then adopts the one it names)",
      ...run2
    },
    {
      vendor: "pimlico",
      bundlers: ["pimlico", "zerodev"],
      chains: "any",
      note: "singleton paymaster 0x7777…834C reverts BundlerNotAllowed (0x55d3ab46) for other bundlers",
      ...run2
    },
    {
      vendor: "pimlico-erc20",
      bundlers: ["pimlico", "zerodev"],
      chains: "any",
      note: "same singleton paymaster; the account approves it",
      ...run2
    },
    {
      vendor: "zerodev",
      bundlers: ["pimlico", "zerodev"],
      chains: "any",
      note: "is Pimlico's singleton paymaster",
      ...run2
    },
    {
      vendor: "erc7677",
      bundlers: "any",
      chains: "any",
      source: "not tested: any ERC-7677 paymaster",
      date: "2026-11-25"
    },
    {
      vendor: "alchemy-bso",
      bundlers: ["alchemy"],
      chains: alchemyChains,
      note: "bundler sponsorship: no paymaster, zero fees",
      ...run2
    },
    {
      vendor: "ultra-relay",
      bundlers: ["zerodev"],
      chains: "any",
      note: "bundler sponsorship: no paymaster, zero fees",
      ...run2
    }
  ],
  rules: [
    {
      code: "PAYMASTER_BUNDLER_BOUND",
      severity: "problem",
      rule:
        "Pimlico's and ZeroDev's sponsorship and Pimlico's ERC-20 paymaster only work through Pimlico's or ZeroDev's bundler; Alchemy's Gas Manager refuses Candide's bundler on Base Sepolia",
      ...run3
    },
    {
      code: "PAYMASTER_AGENT_UNSUPPORTED",
      severity: "problem",
      rule: "Etherspot's Arka sponsors owner operations but refuses agents' (Smart Sessions) operations",
      ...run3
    },
    {
      code: "SPONSORSHIP_BUNDLER_BOUND",
      severity: "problem",
      rule:
        "Alchemy's bundler sponsorship only through Alchemy, UltraRelay only through ZeroDev, and neither with a paymaster",
      ...run2
    },
    {
      code: "EIP7702_UNSUPPORTED",
      severity: "problem",
      rule:
        "Etherspot's EntryPoint 0.7 endpoint rejects EIP-7702 authorizations: a 7702 account's first operation needs another bundler",
      source: "Namera live tests, Base Sepolia (EIP-7702)",
      date: "2026-11-15"
    },
    {
      code: "SLOW_INCLUSION",
      severity: "warning",
      rule: "Etherspot includes operations in about 95 s (132 s at worst): raise waitForUserOperationReceipt's timeout",
      ...run1
    },
    {
      code: "SESSION_PERMIT_REQUIRED",
      severity: "problem",
      rule: "Circle's paymaster for an agent needs the session to allow the USDC permit (Policy.signTypedData)",
      source: "Smart Sessions typed-data policies (SignaturePolicy)",
      date: "2026-11-23"
    },
    {
      code: "NOT_ON_CHAIN",
      severity: "problem",
      rule: "The bundler, paymaster or Namera's session contracts are not on the chain",
      ...scan
    }
  ]
}
