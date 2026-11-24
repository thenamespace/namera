import * as Predicate from "effect/Predicate"

import { allowsCirclePermit } from "../../internal/core/circle.ts"
import type { Session } from "../../internal/core/session/session.ts"
import type * as CompatError from "../CompatError.ts"
import { type BundlerVendor, matrix, type PaymasterVendor, type Sponsorship } from "./matrix.ts"

/**
 * What the rules need to know about an account: whether it is an EIP-7702 account still to be delegated, and the
 * session it acts under (an agent's account, from `Grant.toAccount`).
 *
 * @internal
 */
export interface AccountInfo {
  readonly eip7702?: boolean | undefined
  readonly session?: Session | undefined
}

/**
 * A bundler as the rules see it: its vendor, and the sponsorship it provides itself.
 *
 * @internal
 */
export interface BundlerInfo {
  readonly vendor: BundlerVendor
  readonly sponsorship?: Sponsorship | undefined
}

/** @internal */
export interface Check {
  readonly account?: unknown
  readonly bundler: BundlerVendor | BundlerInfo
  readonly paymaster?: unknown
  readonly chainId: number
}

/** @internal */
export interface Result {
  readonly ok: boolean
  readonly problems: ReadonlyArray<CompatError.Problem>
  readonly warnings: ReadonlyArray<CompatError.Problem>
}

// Local development chains (anvil, Hardhat, Namera's devnet) have whatever their deployer put there.
const LOCAL_CHAINS: ReadonlyArray<number> = [1337, 31337, 31338]

const names: Record<BundlerVendor | PaymasterVendor | Sponsorship, string> = {
  pimlico: "Pimlico",
  "pimlico-erc20": "Pimlico's ERC-20 paymaster",
  alchemy: "Alchemy",
  candide: "Candide",
  zerodev: "ZeroDev",
  etherspot: "Etherspot",
  circle: "Circle",
  erc7677: "the ERC-7677 paymaster",
  custom: "the bundler",
  "alchemy-bso": "Alchemy's bundler sponsorship",
  "ultra-relay": "ZeroDev's UltraRelay"
}

/**
 * The account's facts: from an owner's account's `namera` metadata, an agent's account's `grant`, or as given.
 *
 * @internal
 */
export const accountInfo = (account: unknown): AccountInfo => {
  const metadata = Predicate.hasProperty(account, "namera") ? account.namera : account
  const eip7702 = Predicate.hasProperty(metadata, "eip7702") && metadata.eip7702 === true
  // An agent's account (`Grant.toAccount`) carries its grant.
  const grant = Predicate.hasProperty(account, "grant") ? account.grant : undefined
  const session = Predicate.hasProperty(grant, "session")
    ? grant.session as Session
    : Predicate.hasProperty(account, "session")
    ? account.session as Session | undefined
    : undefined
  return { eip7702, session }
}

const vendorOf = (u: unknown): string | undefined =>
  Predicate.isString(u) ? u : Predicate.hasProperty(u, "vendor") && Predicate.isString(u.vendor) ? u.vendor : undefined

const onChain = (chains: ReadonlyArray<number> | "any", chainId: number) =>
  chains === "any" || chains.includes(chainId) || LOCAL_CHAINS.includes(chainId)

/**
 * Checks a combination against the matrix: `problems` that will fail, `warnings` worth knowing.
 *
 * @internal
 */
export const check = (options: Check): Result => {
  const bundler: BundlerInfo = Predicate.isString(options.bundler) ? { vendor: options.bundler } : options.bundler
  const account = accountInfo(options.account)
  const { chainId } = options
  const problems: Array<CompatError.Problem> = []
  const warnings: Array<CompatError.Problem> = []

  const bundlerEntry = matrix.bundlers.find((entry) => entry.vendor === bundler.vendor)
  if (bundlerEntry !== undefined && !onChain(bundlerEntry.chains, chainId)) {
    problems.push({
      code: "NOT_ON_CHAIN",
      message: `${
        names[bundler.vendor]
      } has no endpoint Namera knows on chain ${chainId}: use Bundler.from with its URL`
    })
  }

  // A bundler that sponsors operations itself takes no paymaster; a sponsorship named as the paymaster must come with
  // its own bundler.
  const paymasterVendor = vendorOf(options.paymaster) as PaymasterVendor | Sponsorship | undefined
  if (bundler.sponsorship !== undefined && options.paymaster !== undefined) {
    problems.push({
      code: "SPONSORSHIP_BUNDLER_BOUND",
      message: `${names[bundler.sponsorship]} pays for the operation itself: remove the paymaster`
    })
  }
  const sponsor = paymasterVendor ?? bundler.sponsorship
  const paymasterEntry = matrix.paymasters.find((entry) => entry.vendor === sponsor)
  if (sponsor !== undefined && paymasterEntry !== undefined) {
    const sponsorship = sponsor === "alchemy-bso" || sponsor === "ultra-relay"
    const allowed = paymasterEntry.bundlers
    if (allowed !== "any" && !allowed.includes(bundler.vendor)) {
      const code = sponsorship ? "SPONSORSHIP_BUNDLER_BOUND" : "PAYMASTER_BUNDLER_BOUND"
      const through = allowed.map((vendor) => names[vendor]).join(" or ")
      if (bundler.vendor === "custom") {
        warnings.push({
          code,
          message: `${names[sponsor]} only works through ${through}'s bundler: check that the custom bundler is one`
        })
      } else {
        problems.push({
          code,
          message: `${names[sponsor]} only works through ${through}'s bundler, not ${names[bundler.vendor]}'s`
        })
      }
    }
    if (!onChain(paymasterEntry.chains, chainId)) {
      problems.push({ code: "NOT_ON_CHAIN", message: `${names[sponsor]} is not on chain ${chainId}` })
    }
  }

  if (account.eip7702 === true && bundlerEntry?.eip7702 === false) {
    problems.push({
      code: "EIP7702_UNSUPPORTED",
      message: `${
        names[bundler.vendor]
      } rejects EIP-7702 authorizations on EntryPoint 0.7: send the account's first operation through another bundler`
    })
  }
  if (bundlerEntry?.inclusion !== undefined && bundlerEntry.inclusion.median >= 30) {
    warnings.push({
      code: "SLOW_INCLUSION",
      message: `${
        names[bundler.vendor]
      } includes operations in about ${bundlerEntry.inclusion.median} s (${bundlerEntry.inclusion.max} s at worst): raise waitForUserOperationReceipt's timeout`
    })
  }

  if (account.session !== undefined) {
    if (paymasterVendor === "circle" && !allowsCirclePermit(account.session, chainId)) {
      problems.push({
        code: "SESSION_PERMIT_REQUIRED",
        message:
          "the session key must sign Circle's USDC permit: the grant's session needs a Policy.signTypedData for USDC's Permit with Circle's paymaster as spender"
      })
    }
    if (!onChain(matrix.account.sessionChains, chainId)) {
      problems.push({ code: "NOT_ON_CHAIN", message: `Namera's session contracts are not on chain ${chainId}` })
    }
  }

  return { ok: problems.length === 0, problems, warnings }
}
