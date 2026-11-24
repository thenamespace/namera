import type * as Effect from "effect/Effect"

import type { NameraError } from "../../../NameraError.ts"
import { fastFees, type Fees, type Rpc } from "./fees.ts"

/**
 * ZeroDev's endpoint on a chain, serving its bundler and its paymaster; UltraRelay (the bundler sponsoring the
 * operation itself) is the same endpoint with `provider=ULTRA_RELAY`.
 *
 * @internal
 */
export const url = (chainId: number, projectId: string, options: { readonly ultraRelay?: boolean } = {}): string =>
  `https://rpc.zerodev.app/api/v3/${encodeURIComponent(projectId)}/chain/${chainId}${
    options.ultraRelay === true ? "?provider=ULTRA_RELAY" : ""
  }`

/**
 * ZeroDev's fees: `zd_getUserOperationGasPrice`, at `fast`.
 *
 * @internal
 */
export const fees = (rpc: Rpc): Effect.Effect<Fees, NameraError> => fastFees(rpc, "zd_getUserOperationGasPrice")
