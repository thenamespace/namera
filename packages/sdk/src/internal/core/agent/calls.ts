import * as AbiParameters from "ox/AbiParameters"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"

import { type Call, encodeCalls as encodeExecute } from "../account/erc7579.ts"
import type { AccountType } from "./nonce.ts"

// The calldata of a session operation (contracts/src/policies/lib/UserOpCalls.sol): ERC-7579 `execute`, then the time
// the agent states (periodic limits charge its period), then SessionHook's tag (sessions with execution policies).
// Kernel runs Smart Sessions' operations through `executeUserOp`, which executes the calldata after its selector.

/** `executeUserOp(PackedUserOperation, bytes32)`. */
const EXECUTE_USER_OP = "0x8dd7712f"
/** `execute(bytes32 mode, bytes executionCalldata)`. */
const EXECUTE = "0xe9ae5c53"

/**
 * The last word of an operation tagged for SessionHook: `… ‖ time ‖ permissionId ‖ SESSION_HOOK_TAG`.
 *
 * @internal
 */
export const SESSION_HOOK_TAG: Hex.Hex = Hash.keccak256(Hex.fromString("namera.session-hook.tag"))

/**
 * A call as a policy sees it: target, value and data, all present.
 *
 * @internal
 */
export interface DecodedCall {
  readonly to: Hex.Hex
  readonly value: bigint
  readonly data: Hex.Hex
}

/**
 * Encodes calls as a session operation's calldata: the stated time when given, SessionHook's tag for `permissionId`
 * when given, and Kernel's `executeUserOp` around it all.
 *
 * @internal
 */
export const encodeCalls = (options: {
  readonly type: AccountType
  readonly calls: ReadonlyArray<Call>
  readonly time?: bigint | undefined
  readonly tag?: Hex.Hex | undefined
}): Hex.Hex => {
  const body = Hex.concat(
    encodeExecute(options.calls),
    options.time === undefined ? "0x" : Hex.fromNumber(options.time, { size: 32 }),
    options.tag === undefined ? "0x" : Hex.concat(options.tag, SESSION_HOOK_TAG)
  )
  return options.type === "kernel" ? Hex.concat(EXECUTE_USER_OP, body) : body
}

const executions = AbiParameters.from(["(address target, uint256 value, bytes callData)[]"])

const word = (data: Hex.Hex, offset: number): bigint => Hex.toBigInt(Hex.slice(data, offset, offset + 32))

const unwrap = (callData: Hex.Hex): Hex.Hex => {
  const data = callData.toLowerCase() as Hex.Hex
  return Hex.size(data) >= 4 && Hex.slice(data, 0, 4) === EXECUTE_USER_OP ? Hex.slice(data, 4) : data
}

/** Where `execute`'s `executionCalldata` starts, and its length. */
const executionData = (callData: Hex.Hex): { readonly start: number; readonly length: number } => {
  const offset = 4 + Number(word(callData, 36))
  return { start: offset + 32, length: Number(word(callData, offset)) }
}

/**
 * The calls a session operation of `account` makes, as Smart Sessions and the policies read them: `execute`'s single
 * call or batch, or, for any other function, one call to the account itself without value. `undefined` for calldata
 * Smart Sessions refuses (another execution mode, or a malformed `execute`).
 *
 * @internal
 */
export const decodeCalls = (callData: Hex.Hex, account: Hex.Hex): ReadonlyArray<DecodedCall> | undefined => {
  const data = unwrap(callData)
  if (Hex.size(data) < 4 || Hex.slice(data, 0, 4) !== EXECUTE) {
    return [{ to: account, value: BigInt(0), data }]
  }
  try {
    const mode = Hex.slice(data, 4, 36)
    // Only the default exec type, with a zero selector and payload.
    if (Hex.toBigInt(Hex.slice(mode, 1)) !== BigInt(0)) return undefined
    const { length, start } = executionData(data)
    const execution = Hex.slice(data, start, start + length)
    if (Hex.slice(mode, 0, 1) === "0x00") {
      if (Hex.size(execution) < 52) return undefined
      return [{
        to: Hex.slice(execution, 0, 20),
        value: Hex.toBigInt(Hex.slice(execution, 20, 52)),
        data: Hex.size(execution) > 52 ? Hex.slice(execution, 52) : "0x"
      }]
    }
    if (Hex.slice(mode, 0, 1) !== "0x01") return undefined
    const [batch] = AbiParameters.decode(executions, execution)
    return batch.map((entry) => ({
      to: entry.target.toLowerCase() as Hex.Hex,
      value: entry.value,
      data: entry.callData
    }))
  } catch {
    return undefined
  }
}

/**
 * The time the agent states in an `execute` operation, as `UserOpCalls.timestamp` reads it: one word right after
 * `execute`'s arguments (and before SessionHook's tag), at most 48 bits.
 *
 * @internal
 */
export const statedTime = (callData: Hex.Hex): bigint | undefined => {
  let data = unwrap(callData)
  const size = Hex.size(data)
  if (size >= 64 && Hex.slice(data, size - 32) === SESSION_HOOK_TAG) data = Hex.slice(data, 0, size - 64)
  if (Hex.size(data) < 68 || Hex.slice(data, 0, 4) !== EXECUTE) return undefined
  try {
    const { length, start } = executionData(data)
    const end = start + Math.ceil(length / 32) * 32
    if (Hex.size(data) !== end + 32) return undefined
    const time = word(data, end)
    return time <= BigInt(2 ** 48 - 1) ? time : undefined
  } catch {
    return undefined
  }
}
