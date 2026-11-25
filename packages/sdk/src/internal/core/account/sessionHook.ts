import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Hex from "ox/Hex"

/**
 * The modules sessions run on: Smart Sessions (the validator) and SessionHook (runs execution policies).
 *
 * @internal
 */
export interface Sessions {
  readonly smartSession: Hex.Hex
  readonly sessionHook: Hex.Hex
}

/**
 * `SessionHook`'s install data: the Smart Sessions module whose sessions it serves.
 *
 * @internal
 */
export const installData = (smartSession: Hex.Hex): Hex.Hex =>
  AbiParameters.encode(AbiParameters.from(["address"]), [smartSession])

const validationConfig = AbiFunction.from(
  "function validationConfig(bytes21 validationId) view returns (uint32, address)"
)

/**
 * Kernel's `validationConfig` view for a validator: its nonce and the hook bound to it.
 *
 * @internal
 */
export const encodeValidationConfig = (validator: Hex.Hex): Hex.Hex =>
  AbiFunction.encodeData(validationConfig, [Hex.concat("0x01", validator)])

/** The hook bound to a Kernel validator, from `validationConfig`. @internal */
export const decodeValidationHook = (result: Hex.Hex): Hex.Hex => AbiFunction.decodeResult(validationConfig, result)[1]
