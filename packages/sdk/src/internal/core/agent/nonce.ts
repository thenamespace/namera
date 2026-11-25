import type * as Hex from "ox/Hex"

import * as Kernel from "../account/kernel.ts"

// Nonce lanes: the free bits of Kernel's nonce key that still route a user operation to Smart Sessions. Each lane has
// its own sequence at the EntryPoint, so operations on different lanes don't wait on each other.

/**
 * How many lanes an account has: the last 2 bytes of Kernel's validator nonce key are free.
 *
 * @internal
 */
export const LANES = 2 ** 16

/**
 * Whether `lane` is a lane of the account.
 *
 * @internal
 */
export const isLane = (lane: number): boolean => Number.isSafeInteger(lane) && lane >= 0 && lane < LANES

/**
 * The nonce key that sends through Smart Sessions on `lane`: Kernel's validator key, ending with the lane.
 *
 * @internal
 */
export const nonceKey = (smartSession: Hex.Hex, lane: number): bigint =>
  Kernel.validatorNonceKey(smartSession) | BigInt(lane)

const LANE_MASK = BigInt(LANES - 1)

/**
 * The lane of a nonce key that sends through Smart Sessions, or `undefined` for a key that doesn't.
 *
 * @internal
 */
export const laneOf = (smartSession: Hex.Hex, key: bigint): number | undefined =>
  (key & ~LANE_MASK) === nonceKey(smartSession, 0) ? Number(key & LANE_MASK) : undefined
