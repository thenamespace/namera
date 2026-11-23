import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Hex from "ox/Hex"

/** A call an account makes: target, value and data. */
export interface Call {
  readonly to: Hex.Hex
  readonly value?: bigint | undefined
  readonly data?: Hex.Hex | undefined
}

/** @internal */
export const MODULE_TYPE_VALIDATOR = BigInt("1")

const execute = AbiFunction.from("function execute(bytes32 mode, bytes executionCalldata)")
const installModule = AbiFunction.from("function installModule(uint256 moduleTypeId, address module, bytes initData)")
const isModuleInstalled = AbiFunction.from(
  "function isModuleInstalled(uint256 moduleTypeId, address module, bytes additionalContext) view returns (bool)"
)
const accountId = AbiFunction.from("function accountId() view returns (string)")

const executions = AbiParameters.from(["(address target, uint256 value, bytes callData)[]"])

// ERC-7579 execution mode: call type (0x00 single, 0x01 batch) ‖ exec type (0x00, revert on failure) ‖ 30 zero
// bytes (unused, selector and payload).
const EXEC_TYPE_DEFAULT = "0x00"
const mode = (callType: "0x00" | "0x01") => Hex.concat(callType, EXEC_TYPE_DEFAULT, Hex.fromNumber(0, { size: 30 }))

/**
 * Encodes calls as one ERC-7579 `execute`: a single call packs `target ‖ value ‖ data`, several calls are an ABI
 * array of executions.
 *
 * @internal
 */
export const encodeCalls = (calls: ReadonlyArray<Call>): Hex.Hex => {
  if (calls.length === 1) {
    // Stryker disable next-line StringLiteral: "" and "0x" concatenate to the same bytes
    const [{ data = "0x", to, value = BigInt("0") }] = calls as readonly [Call]
    return AbiFunction.encodeData(execute, [
      mode("0x00"),
      Hex.concat(to, Hex.fromNumber(value, { size: 32 }), data)
    ])
  }
  return AbiFunction.encodeData(execute, [
    mode("0x01"),
    AbiParameters.encode(executions, [
      // Stryker disable next-line StringLiteral: BigInt("") is 0 too
      calls.map(({ data = "0x", to, value = BigInt("0") }) => ({ target: to, value, callData: data }))
    ])
  ])
}

/** @internal */
export const encodeInstallModule = (moduleType: bigint, module: Hex.Hex, initData: Hex.Hex): Hex.Hex =>
  AbiFunction.encodeData(installModule, [moduleType, module, initData])

/** @internal */
export const encodeIsModuleInstalled = (moduleType: bigint, module: Hex.Hex): Hex.Hex =>
  AbiFunction.encodeData(isModuleInstalled, [moduleType, module, "0x"])

/** @internal */
export const decodeIsModuleInstalled = (result: Hex.Hex): boolean => AbiFunction.decodeResult(isModuleInstalled, result)

/** @internal */
export const encodeAccountId: Hex.Hex = AbiFunction.encodeData(accountId)

/** @internal */
export const decodeAccountId = (result: Hex.Hex): string => AbiFunction.decodeResult(accountId, result)

const isInitialized = AbiFunction.from("function isInitialized(address account) view returns (bool)")

/**
 * A module's `isInitialized(account)` view: whether it holds state for the account.
 *
 * @internal
 */
export const encodeIsInitialized = (account: Hex.Hex): Hex.Hex => AbiFunction.encodeData(isInitialized, [account])

/** Decodes `isInitialized`'s answer. @internal */
export const decodeIsInitialized = (result: Hex.Hex): boolean => AbiFunction.decodeResult(isInitialized, result)
