import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Hex from "ox/Hex"

/** The contracts of one Nexus version. @internal */
export interface Contracts {
  readonly factory: Hex.Hex
  readonly implementation: Hex.Hex
  readonly bootstrap: Hex.Hex
}

const initNexusWithDefaultValidator = AbiFunction.from("function initNexusWithDefaultValidator(bytes data)")
const initNexusWithModules = AbiFunction.from(
  "function initNexusWithDefaultValidatorAndOtherModulesNoRegistry(bytes defaultValidatorInitData, (address module, bytes data)[] validators, (address module, bytes data)[] executors, (address module, bytes data) hook, (address module, bytes data)[] fallbacks, (uint256 hookType, address module, bytes data)[] preValidationHooks)"
)
const createAccount = AbiFunction.from("function createAccount(bytes initData, bytes32 salt) payable returns (address)")
const computeAccountAddress = AbiFunction.from(
  "function computeAccountAddress(bytes initData, bytes32 salt) view returns (address)"
)

/**
 * The bootstrap call that initialises a Nexus account: `owner` on the default (K1) validator, and SmartSession as a
 * second validator when given.
 *
 * @internal
 */
export const bootstrapCall = (options: { readonly owner: Hex.Hex; readonly smartSession?: Hex.Hex | undefined }) =>
  options.smartSession === undefined
    ? AbiFunction.encodeData(initNexusWithDefaultValidator, [options.owner])
    : AbiFunction.encodeData(initNexusWithModules, [
      options.owner,
      [{ module: options.smartSession, data: "0x" }],
      [],
      { module: "0x0000000000000000000000000000000000000000", data: "0x" },
      [],
      []
    ])

/**
 * The factory call of a Nexus account, and the view call that returns its counterfactual address.
 *
 * **Details**
 *
 * Nexus deploys a `NexusProxy` whose constructor runs the initialisation, so its address depends on that proxy's
 * creation code; the factory's `computeAccountAddress` is the source of truth.
 *
 * @internal
 */
export const deployment = (options: {
  readonly contracts: Contracts
  readonly owner: Hex.Hex
  readonly smartSession?: Hex.Hex | undefined
  readonly index: bigint
}): { readonly factoryData: Hex.Hex; readonly addressCall: Hex.Hex } => {
  const initData = AbiParameters.encode(AbiParameters.from(["address", "bytes"]), [
    options.contracts.bootstrap,
    bootstrapCall(options)
  ])
  const salt = Hex.fromNumber(options.index, { size: 32 })
  return {
    factoryData: AbiFunction.encodeData(createAccount, [initData, salt]),
    addressCall: AbiFunction.encodeData(computeAccountAddress, [initData, salt])
  }
}

/** Decodes the factory's `computeAccountAddress` answer. @internal */
export const decodeAddress = (result: Hex.Hex): Hex.Hex => AbiFunction.decodeResult(computeAccountAddress, result)

/**
 * Prefixes an owner signature for ERC-1271: 20 zero bytes select the default validator.
 *
 * @internal
 */
export const ownerSignature = (signature: Hex.Hex): Hex.Hex =>
  Hex.concat("0x0000000000000000000000000000000000000000", signature)
