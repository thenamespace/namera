import * as AbiEvent from "ox/AbiEvent"
import * as AbiFunction from "ox/AbiFunction"
import type * as Hex from "ox/Hex"

// The EntryPoint's record of user operations: its `UserOperationEvent` logs (sender, nonce, outcome, cost), and the
// operations themselves in `handleOps` calldata, whose signatures name the session that signed them.

const userOperationEvent = AbiEvent.from(
  "event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)"
)
const handleOps = AbiFunction.from(
  "function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)"
)

/**
 * The topics that select an account's `UserOperationEvent` logs.
 *
 * @internal
 */
export const userOperationTopics = (sender: Hex.Hex): ReadonlyArray<Hex.Hex | null> =>
  AbiEvent.encode(userOperationEvent, { sender }).topics as ReadonlyArray<Hex.Hex | null>

/**
 * A `UserOperationEvent` log's fields.
 *
 * @internal
 */
export const decodeUserOperationEvent = (log: { readonly data: Hex.Hex; readonly topics: ReadonlyArray<Hex.Hex> }) => {
  const decoded = AbiEvent.decode(userOperationEvent, {
    data: log.data,
    topics: log.topics as [Hex.Hex, ...Array<Hex.Hex>]
  })
  return {
    userOpHash: decoded.userOpHash,
    sender: decoded.sender,
    nonce: decoded.nonce,
    success: decoded.success,
    actualGasCost: decoded.actualGasCost,
    actualGasUsed: decoded.actualGasUsed
  }
}

/**
 * The signature of `sender`'s operation with `nonce` in a `handleOps` transaction's input, or `undefined` when the
 * input isn't `handleOps` (a bundler that bundles through another contract) or has no such operation.
 *
 * @internal
 */
export const operationSignature = (input: Hex.Hex, sender: Hex.Hex, nonce: bigint): Hex.Hex | undefined => {
  try {
    const [ops] = AbiFunction.decodeData(handleOps, input)
    return ops.find((op) => op.sender.toLowerCase() === sender.toLowerCase() && op.nonce === nonce)?.signature
  } catch {
    return undefined
  }
}
