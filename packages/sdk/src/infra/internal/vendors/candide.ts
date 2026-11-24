import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"

import type { NameraError } from "../../../NameraError.ts"
import { type Fees, readFees, type Rpc } from "./fees.ts"

/**
 * Candide's endpoint on a chain, serving its bundler and paymaster: keyed with an API key, or the public endpoint
 * (16 chains, the launch chains among them).
 *
 * @internal
 */
export const url = (chainId: number, apiKey: string | undefined): string =>
  apiKey === undefined
    ? `https://api.candide.dev/public/v3/${chainId}`
    : `https://api.candide.dev/api/v3/${chainId}/${encodeURIComponent(apiKey)}`

/**
 * Candide's fees: `voltaire_feesPerGas` (Candide doesn't serve `eth_maxPriorityFeePerGas`).
 *
 * @internal
 */
export const fees = (rpc: Rpc): Effect.Effect<Fees, NameraError> =>
  Effect.flatMap(rpc("voltaire_feesPerGas"), (answer) => readFees("voltaire_feesPerGas", answer))

/**
 * The paymaster verification gas assumed when neither the paymaster's stub nor the bundler's estimate gives one.
 *
 * @internal
 */
export const DEFAULT_PAYMASTER_VERIFICATION_GAS = BigInt(150_000)

/**
 * The verification gas added to Candide's estimate. Its estimates are the tightest of the vendors' (94–97% of the
 * limits used), and its bundler wants 2,000 gas spare: an agent's operation with Candide's paymaster had 1,533 (Base
 * Sepolia, 2026-11-25), since a session key's real signature costs a little more to check than its stub.
 *
 * @internal
 */
export const VERIFICATION_MARGIN = BigInt(5_000)

/**
 * Adjusts Candide's estimate: adds `VERIFICATION_MARGIN` to the verification gas, and fills the paymaster gas its
 * bundler doesn't estimate (without it an operation would carry none and the paymaster would run out, `AA33` without
 * revert data): the operation's own values, or 150k for verification.
 *
 * @internal
 */
export const adjustEstimate = (params: unknown, answer: unknown): unknown => {
  if (!Predicate.isObject(answer)) return answer
  const estimated = answer as Record<string, unknown>
  const verification = Predicate.isString(estimated.verificationGasLimit)
    ? BigInt(estimated.verificationGasLimit)
    : undefined
  const padded = verification === undefined
    ? estimated
    : { ...estimated, verificationGasLimit: `0x${(verification + VERIFICATION_MARGIN).toString(16)}` }

  const operation = Array.isArray(params) ? params[0] : undefined
  if (!Predicate.hasProperty(operation, "paymaster") || !Predicate.isString(operation.paymaster)) return padded
  const given = (key: string) => (operation as Record<string, unknown>)[key]
  return {
    ...padded,
    paymasterVerificationGasLimit: estimated.paymasterVerificationGasLimit
      ?? given("paymasterVerificationGasLimit")
      ?? `0x${DEFAULT_PAYMASTER_VERIFICATION_GAS.toString(16)}`,
    ...(estimated.paymasterPostOpGasLimit === undefined && given("paymasterPostOpGasLimit") !== undefined
      ? { paymasterPostOpGasLimit: given("paymasterPostOpGasLimit") }
      : {})
  }
}

/**
 * The least call gas Candide's paymaster signs for: it refuses operations below its minimum, which other bundlers'
 * estimates go under (Alchemy's 9,100 for Kernel).
 *
 * @internal
 */
export const MIN_CALL_GAS = BigInt(30_000)

/**
 * The minimum call gas Candide's paymaster named when it refused an operation: it computes one per operation (`0x4603`
 * for a Safe's transfer, `0x86fd` and `0xc271` for a Kernel account's on Base Sepolia, 2026-11-25), so a fixed floor
 * can't cover it.
 *
 * @internal
 */
export const minCallGasOf = (error: { readonly message: string }): bigint | undefined => {
  const named = /callGasLimit is lower than the minimum allowed gas limit for this UserOp of (0x[0-9a-fA-F]+)/.exec(
    error.message
  )
  return named === null ? undefined : BigInt(named[1]!)
}
