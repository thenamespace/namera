import type * as Effect from "effect/Effect"

import type { NameraError } from "../../../NameraError.ts"
import { fastFees, type Fees, type Rpc } from "./fees.ts"

/**
 * Pimlico's endpoint on a chain, serving its bundler and its paymasters.
 *
 * @internal
 */
export const url = (chainId: number, apiKey: string): string =>
  `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${encodeURIComponent(apiKey)}`

/**
 * Pimlico's fees: `pimlico_getUserOperationGasPrice`, at `fast`.
 *
 * @internal
 */
export const fees = (rpc: Rpc): Effect.Effect<Fees, NameraError> => fastFees(rpc, "pimlico_getUserOperationGasPrice")
