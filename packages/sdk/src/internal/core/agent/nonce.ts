import type * as Hex from "ox/Hex"

import * as Kernel from "../account/kernel.ts"
import * as Nexus from "../account/nexus.ts"
import * as Safe7579 from "../account/safe7579.ts"

// Nonce lanes: the free bits of each account's nonce key that still route a user operation to Smart Sessions. Each
// lane has its own sequence at the EntryPoint, so operations on different lanes don't wait on each other.

/**
 * The account types an agent sends from.
 *
 * @internal
 */
export type AccountType = "kernel" | "nexus" | "safe7579"

/**
 * How many lanes each account type has: Kernel's key has 16 free bits, Nexus's 24, Safe7579's 32.
 *
 * @internal
 */
export const lanes: Record<AccountType, number> = { kernel: 2 ** 16, nexus: 2 ** 24, safe7579: 2 ** 32 }

/**
 * Whether `lane` is a lane of the account type.
 *
 * @internal
 */
export const isLane = (type: AccountType, lane: number): boolean =>
  Number.isSafeInteger(lane) && lane >= 0 && lane < lanes[type]

/**
 * The nonce key that sends through Smart Sessions on `lane`: Kernel's key ends with its 2 free bytes, Nexus's starts
 * with its 3, Safe7579's ends with its 4.
 *
 * @internal
 */
export const nonceKey = (type: AccountType, smartSession: Hex.Hex, lane: number): bigint => {
  switch (type) {
    case "kernel":
      return Kernel.validatorNonceKey(smartSession) | BigInt(lane)
    case "nexus":
      return Nexus.validatorNonceKey(smartSession) | (BigInt(lane) << BigInt(168))
    case "safe7579":
      return Safe7579.validatorNonceKey(smartSession) | BigInt(lane)
  }
}

const laneMasks: Record<AccountType, bigint> = {
  kernel: BigInt(0xffff),
  nexus: BigInt(0xffffff) << BigInt(168),
  safe7579: BigInt(0xffffffff)
}

/**
 * The lane of a nonce key that sends through Smart Sessions, or `undefined` for a key that doesn't.
 *
 * @internal
 */
export const laneOf = (type: AccountType, smartSession: Hex.Hex, key: bigint): number | undefined => {
  const mask = laneMasks[type]
  if ((key & ~mask) !== nonceKey(type, smartSession, 0)) return undefined
  return Number(type === "nexus" ? (key & mask) >> BigInt(168) : key & mask)
}
