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
 * Candide's bundler estimates no paymaster gas: without the fields, an operation would carry no paymaster gas and
 * the paymaster would run out of it (`AA33` without revert data). Fills what the estimate leaves out: the operation's
 * own values, or 150k for verification.
 *
 * @internal
 */
export const fillPaymasterGas = (params: unknown, answer: unknown): unknown => {
  const operation = Array.isArray(params) ? params[0] : undefined
  if (!Predicate.hasProperty(operation, "paymaster") || !Predicate.isString(operation.paymaster)) return answer
  if (!Predicate.isObject(answer)) return answer
  const given = (key: string) => (operation as Record<string, unknown>)[key]
  const estimated = answer as Record<string, unknown>
  return {
    ...estimated,
    paymasterVerificationGasLimit: estimated.paymasterVerificationGasLimit
      ?? given("paymasterVerificationGasLimit")
      ?? `0x${DEFAULT_PAYMASTER_VERIFICATION_GAS.toString(16)}`,
    ...(estimated.paymasterPostOpGasLimit === undefined && given("paymasterPostOpGasLimit") !== undefined
      ? { paymasterPostOpGasLimit: given("paymasterPostOpGasLimit") }
      : {})
  }
}

/**
 * The least call gas Candide's paymaster signs for: it refuses operations below its minimum (`0x4603` for a Safe
 * on Base Sepolia), which other bundlers' estimates go under (Alchemy's 9,100 for Kernel).
 *
 * @internal
 */
export const MIN_CALL_GAS = BigInt(30_000)
