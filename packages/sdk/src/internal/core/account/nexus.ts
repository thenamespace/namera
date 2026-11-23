import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Hex from "ox/Hex"

import * as SessionHook from "./sessionHook.ts"

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
const initNexusScoped = AbiFunction.from(
  "function initNexusScoped((address module, bytes data)[] validators, (address module, bytes data) hook)"
)
const createAccount = AbiFunction.from("function createAccount(bytes initData, bytes32 salt) payable returns (address)")
const computeAccountAddress = AbiFunction.from(
  "function computeAccountAddress(bytes initData, bytes32 salt) view returns (address)"
)

/**
 * Who owns a Nexus account: an address on the default (K1) validator, or a validator module installed with its data
 * (Namera's `WebAuthnValidator` for passkeys).
 *
 * @internal
 */
export type Owner =
  | { readonly type: "default"; readonly address: Hex.Hex }
  | { readonly type: "module"; readonly validator: Hex.Hex; readonly data: Hex.Hex }

const zeroAddress = "0x0000000000000000000000000000000000000000"

/**
 * The bootstrap call that initialises a Nexus account: the owner on the default validator or as a validator module,
 * and Smart Sessions as another validator with SessionHook as the account's hook when given.
 *
 * @internal
 */
export const bootstrapCall = (options: {
  readonly owner: Owner
  readonly sessions?: SessionHook.Sessions | undefined
}) => {
  const { sessions } = options
  const validators: ReadonlyArray<{ readonly module: Hex.Hex; readonly data: Hex.Hex }> = sessions === undefined
    ? []
    : [{ module: sessions.smartSession, data: "0x" }]
  const hook: { readonly module: Hex.Hex; readonly data: Hex.Hex } = sessions === undefined
    ? { module: zeroAddress, data: "0x" }
    : { module: sessions.sessionHook, data: SessionHook.installData("nexus", sessions.smartSession) }
  if (options.owner.type === "module") {
    return AbiFunction.encodeData(initNexusScoped, [
      [{ module: options.owner.validator, data: options.owner.data }, ...validators],
      hook
    ])
  }
  return sessions === undefined
    ? AbiFunction.encodeData(initNexusWithDefaultValidator, [options.owner.address])
    : AbiFunction.encodeData(initNexusWithModules, [options.owner.address, validators, [], hook, [], []])
}

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
  readonly owner: Owner
  readonly sessions?: SessionHook.Sessions | undefined
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
 * The nonce key that selects a validator: Nexus reads the nonce as free bytes ‖ mode (0, validation) ‖ validator ‖
 * sequence, and the zero address is the default validator.
 *
 * @internal
 */
export const validatorNonceKey = (validator: Hex.Hex): bigint => Hex.toBigInt(validator)

/**
 * Prefixes an owner signature for ERC-1271 with the validator it is for; the zero address selects the default
 * validator.
 *
 * @internal
 */
export const ownerSignature = (validator: Hex.Hex, signature: Hex.Hex): Hex.Hex => Hex.concat(validator, signature)

const transferOwnership = AbiFunction.from("function transferOwnership(address newOwner)")
const getOwner = AbiFunction.from("function getOwner(address account) view returns (address)")

/**
 * The call that makes `owner` the default (K1) validator's owner for the calling account. It also sets the owner of
 * a passkey account whose K1 validator has none.
 *
 * @internal
 */
export const transferOwnershipData = (owner: Hex.Hex): Hex.Hex => AbiFunction.encodeData(transferOwnership, [owner])

/** The K1 validator's owner view. @internal */
export const encodeOwner = (account: Hex.Hex): Hex.Hex => AbiFunction.encodeData(getOwner, [account])

/** Decodes the K1 validator's owner. @internal */
export const decodeOwner = (result: Hex.Hex): Hex.Hex => AbiFunction.decodeResult(getOwner, result)
