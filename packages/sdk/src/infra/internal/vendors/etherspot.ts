import * as Effect from "effect/Effect"

import type { NameraError } from "../../../NameraError.ts"
import { type Fees, readFees, type Rpc } from "./fees.ts"

/**
 * Etherspot's keyed Skandha bundler on a chain. Its keyless `rpc.erc4337.io` serves only EntryPoint 0.9.
 *
 * @internal
 */
export const bundlerUrl = (chainId: number, apiKey: string): string =>
  `https://rpc.etherspot.io/v2/${chainId}?api-key=${encodeURIComponent(apiKey)}`

/**
 * Etherspot's Arka paymaster on a chain, in verifying-paymaster mode (`useVp=true`), which ERC-7677 needs.
 *
 * @internal
 */
export const arkaUrl = (chainId: number, apiKey: string): string =>
  `https://rpc.etherspot.io/paymaster/?apiKey=${encodeURIComponent(apiKey)}&chainId=${chainId}&useVp=true`

/**
 * Etherspot's fees: `skandha_getGasPrice`.
 *
 * @internal
 */
export const fees = (rpc: Rpc): Effect.Effect<Fees, NameraError> =>
  Effect.flatMap(rpc("skandha_getGasPrice"), (answer) => readFees("skandha_getGasPrice", answer))
