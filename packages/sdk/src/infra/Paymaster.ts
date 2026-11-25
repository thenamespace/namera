/**
 * Paymasters as viem paymasters: each helper returns `getPaymasterStubData` and `getPaymasterData` for the
 * `paymaster` option of viem's `createBundlerClient`.
 *
 * **Details**
 *
 * Every paymaster here is ERC-7677 except Circle's, which has no API. The helpers:
 *
 * - send stub requests with zeroed gas fields, as some paymasters require;
 * - give a stub without paymaster verification gas 150k, since some bundlers don't estimate it (Candide's);
 * - never change a field after `pm_getPaymasterData` signs it: the operation keeps the gas limits the paymaster
 *   signed over, estimated by the bundler that will send it;
 * - keep API keys out of every error, and turn the vendors' refusals into `PaymasterError`.
 *
 * Not every paymaster works with every bundler: `Compat.check` knows which, and the `Bundler.*` helpers refuse
 * combinations that can't work before signing. `vendor` names the paymaster for `Compat.check`.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type { HttpTransportConfig } from "../internal/viem/infra.ts"
import type { SmartAccount } from "../internal/viem/smartAccount.ts"
import type { PaymasterVendor } from "./internal/matrix.ts"
import * as internal from "./internal/paymaster.ts"
import * as alchemyVendor from "./internal/vendors/alchemy.ts"
import * as candideVendor from "./internal/vendors/candide.ts"
import * as circleVendor from "./internal/vendors/circle.ts"
import * as etherspotVendor from "./internal/vendors/etherspot.ts"
import * as pimlicoVendor from "./internal/vendors/pimlico.ts"
import * as zerodevVendor from "./internal/vendors/zerodev.ts"

/**
 * A viem paymaster, for the `paymaster` option of `createBundlerClient`, with its vendor for `Compat.check`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Paymaster = internal.Paymaster

/**
 * The paymaster vendors Namera knows, and `erc7677` for `Paymaster.erc7677`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Vendor = PaymasterVendor

/**
 * The settings every helper takes besides the vendor's credentials.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Settings {
  /** viem's HTTP transport options (`timeout`, `retryCount`, `fetchOptions`, …) for the vendor's endpoint. */
  readonly http?: HttpTransportConfig | undefined
}

/**
 * Pimlico's sponsorship paymaster, with a sponsorship policy or the API key's default.
 *
 * **Gotchas**
 *
 * Pimlico's paymaster contract only accepts operations from Pimlico's and ZeroDev's bundlers
 * (`PAYMASTER_BUNDLER_BOUND`); others fail with `BundlerNotAllowed`.
 *
 * **Example** (Sponsored through Pimlico)
 *
 * ```ts import.meta.vitest
 * import { Bundler, Compat, Paymaster } from "@namera-ai/sdk"
 *
 * const paymaster = Paymaster.pimlico({ apiKey: "pim_test", policyId: "sp_test" })
 * paymaster.vendor // => "pimlico"
 * Compat.check({ bundler: Bundler.pimlico({ apiKey: "pim_test" }), paymaster, chainId: 84532 }).ok // => true
 * // createBundlerClient({ account, client, ...Bundler.pimlico({ apiKey }), paymaster })
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const pimlico = (options: pimlico.Options): Paymaster =>
  internal.erc7677({
    vendor: "pimlico",
    url: (chainId) => pimlicoVendor.url(chainId, options.apiKey),
    context: options.policyId === undefined ? {} : { sponsorshipPolicyId: options.policyId },
    secrets: [options.apiKey],
    http: options.http
  })

/**
 * Types of `Paymaster.pimlico`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace pimlico {
  /**
   * Pimlico's API key, and the sponsorship policy.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends Settings {
    readonly apiKey: string
    readonly policyId?: string | undefined
  }
}

/**
 * Pimlico's ERC-20 paymaster: the account pays gas in `token`.
 *
 * **Gotchas**
 *
 * The account must have approved the paymaster for the token: batch an `approve` with the operation's calls (the
 * paymaster's address is in the stub's `paymaster`). Only Pimlico's and ZeroDev's bundlers
 * (`PAYMASTER_BUNDLER_BOUND`).
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const pimlicoErc20 = (options: pimlicoErc20.Options): Paymaster =>
  internal.erc7677({
    vendor: "pimlico-erc20",
    url: (chainId) => pimlicoVendor.url(chainId, options.apiKey),
    context: { token: options.token },
    secrets: [options.apiKey],
    http: options.http
  })

/**
 * Types of `Paymaster.pimlicoErc20`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace pimlicoErc20 {
  /**
   * Pimlico's API key, and the token's address.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends Settings {
    readonly apiKey: string
    readonly token: `0x${string}`
  }
}

/**
 * Alchemy's Gas Manager (an onchain paymaster policy), which works with any bundler except Candide's on Base Sepolia
 * (`PAYMASTER_BUNDLER_BOUND`).
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const alchemy = (options: alchemy.Options): Paymaster =>
  internal.erc7677({
    vendor: "alchemy",
    url: (chainId) => alchemyVendor.url(chainId, options.apiKey),
    context: { policyId: options.policyId },
    secrets: [options.apiKey],
    http: options.http
  })

/**
 * Types of `Paymaster.alchemy`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace alchemy {
  /**
   * Alchemy's API key, and the Gas Manager policy.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends Settings {
    readonly apiKey: string
    readonly policyId: string
  }
}

/**
 * Candide's sponsorship paymaster, which works with any bundler.
 *
 * **Details**
 *
 * Candide's paymaster refuses operations below a minimum call gas it computes per operation, which other bundlers'
 * estimates go under: the helper raises the call gas limit to 30k before Candide signs, and to the minimum Candide
 * names when it still refuses.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const candide = (options: candide.Options): Paymaster =>
  internal.erc7677({
    vendor: "candide",
    url: (chainId) => candideVendor.url(chainId, options.apiKey),
    context: { sponsorshipPolicyId: options.policyId },
    secrets: options.apiKey === undefined ? [] : [options.apiKey],
    http: options.http,
    minCallGas: candideVendor.MIN_CALL_GAS,
    minCallGasOf: candideVendor.minCallGasOf
  })

/**
 * Types of `Paymaster.candide`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace candide {
  /**
   * Candide's API key (without one, its public endpoint), and the sponsorship policy (one per chain).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends Settings {
    readonly apiKey?: string | undefined
    readonly policyId: string
  }
}

/**
 * ZeroDev's sponsorship paymaster.
 *
 * **Gotchas**
 *
 * It is Pimlico's paymaster contract, so it only works through Pimlico's and ZeroDev's bundlers
 * (`PAYMASTER_BUNDLER_BOUND`).
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const zerodev = (options: zerodev.Options): Paymaster =>
  internal.erc7677({
    vendor: "zerodev",
    url: (chainId) => zerodevVendor.url(chainId, options.projectId),
    context: {},
    secrets: [options.projectId],
    http: options.http
  })

/**
 * Types of `Paymaster.zerodev`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace zerodev {
  /**
   * ZeroDev's project id.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends Settings {
    readonly projectId: string
  }
}

/**
 * Etherspot's Arka paymaster in verifying mode, which works with any bundler for the owner's operations. It refuses
 * agents' operations (`PAYMASTER_AGENT_UNSUPPORTED`).
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const etherspot = (options: etherspot.Options): Paymaster =>
  internal.erc7677({
    vendor: "etherspot",
    url: (chainId) => etherspotVendor.arkaUrl(chainId, options.apiKey),
    context: options.policyId === undefined ? {} : { policyId: options.policyId },
    secrets: [options.apiKey],
    http: options.http
  })

/**
 * Types of `Paymaster.etherspot`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace etherspot {
  /**
   * Arka's API key, and the sponsorship policy (without one, the key's default).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends Settings {
    readonly apiKey: string
    readonly policyId?: string | undefined
  }
}

/**
 * Circle's USDC paymaster: the account pays gas in USDC, with no API and no key, through any bundler.
 *
 * **Details**
 *
 * The account signs an EIP-2612 permit of USDC to Circle's paymaster, sent as its `paymasterData`
 * (`uint8 0 ‖ USDC ‖ amount ‖ signature`): `maxAmount` for the stub the bundler simulates, then the operation's
 * worst-case cost (priced at 20,000 USDC per ether) plus 20%, at most `maxAmount`, for the operation sent. The
 * paymaster takes the real cost and refunds the rest. Paymaster gas is 200k for verification and 50k for postOp.
 *
 * The account signs through `signTypedData`: an owner account as its owner; an agent's account (`Grant.toAccount`)
 * with the session key, which needs the session to allow the permit (`Policy.signTypedData` for USDC's `Permit` with
 * Circle's paymaster as spender and `value` at least `maxAmount`; `Compat.check` reports
 * `SESSION_PERMIT_REQUIRED` without it). An agent's account must be deployed first, since session signatures need
 * the session enabled.
 *
 * Circle's EntryPoint 0.7 paymaster is on Base Sepolia (tested live), Sepolia, Arbitrum Sepolia and Base.
 *
 * **Gotchas**
 *
 * viem gives a paymaster no account, so the `Bundler.*` helpers record it when they prepare an operation: use one,
 * or pass `account`.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const circle = (options: circle.Options): Paymaster => circleVendor.circle(options)

/**
 * Types of `Paymaster.circle`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace circle {
  /**
   * The token (USDC), the most it permits per operation in its smallest unit (default 1 USDC), and the account to
   * sign with when the bundler client isn't configured by a `Bundler.*` helper.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly token: "USDC"
    readonly maxAmount?: bigint | undefined
    readonly account?: SmartAccount | undefined
  }
}

/**
 * Any ERC-7677 paymaster, by URL, with the context its methods take.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const erc7677 = (options: erc7677.Options): Paymaster =>
  internal.erc7677({
    vendor: "erc7677",
    url: () => options.url,
    context: options.context,
    secrets: [],
    http: options.http
  })

/**
 * Types of `Paymaster.erc7677`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace erc7677 {
  /**
   * The paymaster's URL, and its context (a sponsorship policy, a token, …).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends Settings {
    readonly url: string
    readonly context?: unknown
  }
}
