import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"

import type { NameraError } from "../../../NameraError.ts"
import { quantity, unreadable } from "../endpoint.ts"

/**
 * The fees a user operation offers.
 */
export interface Fees {
  readonly maxFeePerGas: bigint
  readonly maxPriorityFeePerGas: bigint
}

/**
 * A JSON-RPC request to the bundler that will submit the operation.
 *
 * @internal
 */
export type Rpc = (method: string, params?: ReadonlyArray<unknown>) => Effect.Effect<unknown, NameraError>

/**
 * Reads `{ maxFeePerGas, maxPriorityFeePerGas }` (hex quantities), the shape every vendor's fee method answers with
 * (Pimlico's and ZeroDev's per speed).
 *
 * @internal
 */
export const readFees = (method: string, answer: unknown): Effect.Effect<Fees, NameraError> => {
  const maxFeePerGas = quantity(Predicate.hasProperty(answer, "maxFeePerGas") ? answer.maxFeePerGas : undefined)
  const maxPriorityFeePerGas = quantity(
    Predicate.hasProperty(answer, "maxPriorityFeePerGas") ? answer.maxPriorityFeePerGas : undefined
  )
  return maxFeePerGas === undefined || maxPriorityFeePerGas === undefined
    ? Effect.fail(unreadable(method))
    : Effect.succeed({ maxFeePerGas, maxPriorityFeePerGas })
}

/**
 * Fees from a method answering per speed (`slow`, `standard`, `fast`), at `fast`: the speed Namera's live tests
 * used, which no bundler refused.
 *
 * @internal
 */
export const fastFees = (rpc: Rpc, method: string): Effect.Effect<Fees, NameraError> =>
  Effect.flatMap(
    rpc(method),
    (answer) => readFees(method, Predicate.hasProperty(answer, "fast") ? answer.fast : answer)
  )
