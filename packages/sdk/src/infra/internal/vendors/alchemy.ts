import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"

import type { NameraError } from "../../../NameraError.ts"
import { quantity, unreadable } from "../endpoint.ts"
import type { Fees, Rpc } from "./fees.ts"

/**
 * Alchemy's network names, by chain id: Alchemy's URLs name the network, not the chain id.
 *
 * @internal
 */
export const networks: { readonly [chainId: number]: string } = {
  1: "eth-mainnet",
  11155111: "eth-sepolia",
  8453: "base-mainnet",
  84532: "base-sepolia",
  42161: "arb-mainnet",
  421614: "arb-sepolia",
  10: "opt-mainnet",
  11155420: "opt-sepolia",
  137: "polygon-mainnet",
  80002: "polygon-amoy",
  43114: "avax-mainnet",
  43113: "avax-fuji"
}

/**
 * Alchemy's endpoint on a chain (node, bundler and Gas Manager), or `undefined` for a chain Namera has no network
 * name for.
 *
 * @internal
 */
export const url = (chainId: number, apiKey: string): string | undefined => {
  const network = networks[chainId]
  return network === undefined ? undefined : `https://${network}.g.alchemy.com/v2/${encodeURIComponent(apiKey)}`
}

/**
 * Alchemy's fees: Rundler's `rundler_maxPriorityFeePerGas` plus 30%, and twice the latest base fee on top (Alchemy's
 * endpoint is also a node).
 *
 * @internal
 */
export const fees = (rpc: Rpc): Effect.Effect<Fees, NameraError> =>
  Effect.gen(function*() {
    const [priority, block] = yield* Effect.all([
      rpc("rundler_maxPriorityFeePerGas"),
      rpc("eth_getBlockByNumber", ["latest", false])
    ], { concurrency: 2 })
    const suggested = quantity(priority)
    if (suggested === undefined) return yield* unreadable("rundler_maxPriorityFeePerGas")
    const baseFee = quantity(Predicate.hasProperty(block, "baseFeePerGas") ? block.baseFeePerGas : undefined)
    if (baseFee === undefined) return yield* unreadable("eth_getBlockByNumber")

    const maxPriorityFeePerGas = (suggested * BigInt(13)) / BigInt(10)
    return { maxFeePerGas: BigInt(2) * baseFee + maxPriorityFeePerGas, maxPriorityFeePerGas }
  })

/**
 * The header naming the policy of Alchemy's bundler sponsorship (BSO), which pays for operations without a
 * paymaster.
 *
 * @internal
 */
export const POLICY_HEADER = "x-alchemy-policy-id"

/**
 * Alchemy's bundler sponsorship pays the operation's gas itself: it wants no preVerificationGas.
 *
 * @internal
 */
export const zeroPreVerificationGas = (answer: unknown): unknown =>
  Predicate.isObject(answer) ? { ...answer, preVerificationGas: "0x0" } : answer
