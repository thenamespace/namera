/**
 * Bundlers as viem configuration: each helper returns the `transport` and the `userOperation` fee hook to spread into
 * viem's `createBundlerClient`.
 *
 * **Details**
 *
 * Each helper builds the vendor's endpoint for the client's chain, reads fees from the vendor's own method (the
 * submitting bundler's prices are the ones it accepts), applies the vendor's estimate quirks, and keeps API keys out
 * of every error. Its fee hook, which viem runs when preparing each operation, runs `Compat.check` on the account,
 * this bundler and the client's paymaster, and refuses a combination that can't work with `CompatError` before
 * anything is signed (opt out with `strict: false`). `vendor` names the bundler for `Compat.check`.
 *
 * Namera's accounts use EntryPoint 0.7, which every helper's endpoint serves.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type { HttpTransportConfig } from "../internal/viem/infra.ts"
import * as internal from "./internal/bundler.ts"
import type { BundlerVendor, Sponsorship as SponsorshipVendor } from "./internal/matrix.ts"
import * as alchemyVendor from "./internal/vendors/alchemy.ts"
import * as candideVendor from "./internal/vendors/candide.ts"
import * as etherspotVendor from "./internal/vendors/etherspot.ts"
import * as pimlicoVendor from "./internal/vendors/pimlico.ts"
import * as zerodevVendor from "./internal/vendors/zerodev.ts"

/**
 * A bundler's viem configuration: spread it into `createBundlerClient`. `vendor` and `sponsorship` say which bundler
 * it is, for `Compat.check`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Bundler = internal.Bundler

/**
 * The bundler vendors Namera knows, and `custom` for `Bundler.from`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Vendor = BundlerVendor

/**
 * Sponsorship a bundler gives itself, without a paymaster: Alchemy's bundler sponsorship (`alchemy-bso`) and
 * ZeroDev's UltraRelay (`ultra-relay`).
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Sponsorship = SponsorshipVendor

/**
 * The settings every helper takes besides the vendor's credentials.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Settings {
  /**
   * Refuse combinations `Compat.check` finds problems with, with `CompatError`, before signing (default `true`).
   */
  readonly strict?: boolean | undefined
  /** viem's HTTP transport options (`timeout`, `retryCount`, `fetchOptions`, …) for the vendor's endpoint. */
  readonly http?: HttpTransportConfig | undefined
}

const strictOf = (options: Settings) => options.strict !== false

/**
 * Pimlico's bundler. Fees come from `pimlico_getUserOperationGasPrice` (`fast`).
 *
 * **Example** (A bundler client through Pimlico)
 *
 * ```ts import.meta.vitest
 * import { Bundler } from "@namera-ai/sdk"
 *
 * const bundler = Bundler.pimlico({ apiKey: "pim_test" })
 * bundler.vendor // => "pimlico"
 * // createBundlerClient({ account, client, ...bundler })
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const pimlico = (options: pimlico.Options): Bundler =>
  internal.make({
    vendor: "pimlico",
    url: (chainId) => (chainId === undefined ? undefined : pimlicoVendor.url(chainId, options.apiKey)),
    secrets: [options.apiKey],
    http: options.http,
    strict: strictOf(options),
    fees: ({ rpc }) => pimlicoVendor.fees(rpc)
  })

/**
 * Types of `Bundler.pimlico`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace pimlico {
  /**
   * Pimlico's API key.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends Settings {
    readonly apiKey: string
  }
}

/**
 * Alchemy's bundler (Rundler). Fees are `rundler_maxPriorityFeePerGas` plus 30%, over twice the base fee.
 *
 * **Details**
 *
 * With `sponsorship: { policyId }`, Alchemy's bundler sponsors the operations itself (bundler sponsored operations):
 * no paymaster, zero fees and preVerificationGas, the policy in the `x-alchemy-policy-id` header. Alchemy's URLs
 * name the network, so the helper knows Ethereum, Base, Arbitrum, OP, Polygon and Avalanche and their testnets;
 * on another chain, use `Bundler.from` with Alchemy's URL.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const alchemy = (options: alchemy.Options): Bundler =>
  internal.make({
    vendor: "alchemy",
    ...(options.sponsorship === undefined ? {} : { sponsorship: "alchemy-bso" as const }),
    url: (chainId) => (chainId === undefined ? undefined : alchemyVendor.url(chainId, options.apiKey)),
    ...(options.sponsorship === undefined
      ? {}
      : {
        headers: { [alchemyVendor.POLICY_HEADER]: options.sponsorship.policyId },
        estimate: (_: unknown, answer: unknown) => alchemyVendor.zeroPreVerificationGas(answer)
      }),
    secrets: [options.apiKey],
    http: options.http,
    strict: strictOf(options),
    fees: ({ rpc }) => alchemyVendor.fees(rpc)
  })

/**
 * Types of `Bundler.alchemy`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace alchemy {
  /**
   * Alchemy's API key, and the Gas Manager policy for bundler sponsorship.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends Settings {
    readonly apiKey: string
    readonly sponsorship?: { readonly policyId: string } | undefined
  }
}

/**
 * Candide's bundler (Voltaire), keyed or through its public endpoint. Fees come from `voltaire_feesPerGas`.
 *
 * **Details**
 *
 * Candide estimates no paymaster gas, so the helper fills the paymaster fields its estimates leave out (the
 * operation's own, or 150k for verification) instead of sending none. Its estimates are also the tightest, so the
 * helper adds 5,000 verification gas: its bundler wants 2,000 spare, which an agent's operation didn't have.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const candide = (options: candide.Options = {}): Bundler =>
  internal.make({
    vendor: "candide",
    url: (chainId) => (chainId === undefined ? undefined : candideVendor.url(chainId, options.apiKey)),
    secrets: options.apiKey === undefined ? [] : [options.apiKey],
    http: options.http,
    strict: strictOf(options),
    fees: ({ rpc }) => candideVendor.fees(rpc),
    estimate: candideVendor.adjustEstimate
  })

/**
 * Types of `Bundler.candide`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace candide {
  /**
   * Candide's API key; without one, Candide's public endpoint.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends Settings {
    readonly apiKey?: string | undefined
  }
}

/**
 * ZeroDev's bundler. Fees come from `zd_getUserOperationGasPrice` (`fast`).
 *
 * **Details**
 *
 * With `sponsorship: "ultra-relay"`, ZeroDev's UltraRelay sponsors the operations itself: no paymaster and zero
 * fees.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const zerodev = (options: zerodev.Options): Bundler =>
  internal.make({
    vendor: "zerodev",
    ...(options.sponsorship === "ultra-relay" ? { sponsorship: "ultra-relay" as const } : {}),
    url: (chainId) =>
      chainId === undefined
        ? undefined
        : zerodevVendor.url(chainId, options.projectId, { ultraRelay: options.sponsorship === "ultra-relay" }),
    secrets: [options.projectId],
    http: options.http,
    strict: strictOf(options),
    fees: ({ rpc }) => zerodevVendor.fees(rpc)
  })

/**
 * Types of `Bundler.zerodev`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace zerodev {
  /**
   * ZeroDev's project id, and UltraRelay sponsorship.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends Settings {
    readonly projectId: string
    readonly sponsorship?: "ultra-relay" | undefined
  }
}

/**
 * Etherspot's bundler (Skandha). Fees come from `skandha_getGasPrice`.
 *
 * **Gotchas**
 *
 * Etherspot includes operations in about 95 s (132 s at worst, `SLOW_INCLUSION`): raise
 * `waitForUserOperationReceipt`'s timeout, and don't send the next operation on the same nonce lane before the
 * previous one is included. Its EntryPoint 0.7 endpoint rejects EIP-7702 authorizations (`EIP7702_UNSUPPORTED`):
 * delegate a 7702 account through another bundler first.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const etherspot = (options: etherspot.Options): Bundler =>
  internal.make({
    vendor: "etherspot",
    url: (chainId) => (chainId === undefined ? undefined : etherspotVendor.bundlerUrl(chainId, options.apiKey)),
    secrets: [options.apiKey],
    http: options.http,
    strict: strictOf(options),
    fees: ({ rpc }) => etherspotVendor.fees(rpc)
  })

/**
 * Types of `Bundler.etherspot`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace etherspot {
  /**
   * Etherspot's API key.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends Settings {
    readonly apiKey: string
  }
}

/**
 * Any bundler, by URL: the bundler's own estimates, and fees from the node behind the bundler client (its `client`),
 * doubled as viem does.
 *
 * **Details**
 *
 * Its vendor is `custom`: `Compat.check` can't tell which bundler it is, so rules that depend on the bundler are
 * warnings, not problems.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const from = (options: from.Options): Bundler =>
  internal.make({
    vendor: "custom",
    url: () => options.url,
    secrets: [],
    http: options.http,
    strict: strictOf(options),
    fees: internal.nodeFeesOf
  })

/**
 * Types of `Bundler.from`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace from {
  /**
   * The bundler's URL.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends Settings {
    readonly url: string
  }
}
