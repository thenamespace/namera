import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Address from "ox/Address"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"
import * as TypedData from "ox/TypedData"

import { predictAddress } from "./erc1967.ts"
import { encodeInstallModule, MODULE_TYPE_VALIDATOR } from "./erc7579.ts"
import * as SessionHook from "./sessionHook.ts"

/** The contracts of one Kernel version. @internal */
export interface Contracts {
  readonly factory: Hex.Hex
  readonly factoryStaker: Hex.Hex
  readonly implementation: Hex.Hex
  readonly ecdsaValidator: Hex.Hex
}

const initialize = AbiFunction.from(
  "function initialize(bytes21 rootValidator, address hook, bytes validatorData, bytes hookData, bytes[] initConfig)"
)
const deployWithFactory = AbiFunction.from(
  "function deployWithFactory(address factory, bytes createData, bytes32 salt) payable returns (address)"
)

// `execute(bytes32,bytes)`: the only selector a Kernel grants an installed (non-root) validator such as SmartSession.
const EXECUTE = "0xe9ae5c53"

// A validator identifier: type 0x01 (validator) ‖ address.
const validatorId = (validator: Hex.Hex) => Hex.concat("0x01", validator)

/**
 * The validator install data Kernel expects: hook ‖ `abi.encode(validatorData, hookData, selectorData)`, granting the
 * validator `execute`. Without a hook, `address(1)` (none); with one, `hookData` is flag `0xff` (always run the
 * hook's `onInstall`) ‖ the hook's install data.
 *
 * @internal
 */
export const validatorInstallData = (
  validatorData: Hex.Hex,
  hook?: { readonly address: Hex.Hex; readonly data: Hex.Hex } | undefined
): Hex.Hex =>
  Hex.concat(
    hook === undefined ? "0x0000000000000000000000000000000000000001" : hook.address,
    AbiParameters.encode(AbiParameters.from(["bytes", "bytes", "bytes"]), [
      validatorData,
      hook === undefined ? "0x" : Hex.concat("0xff", hook.data),
      EXECUTE
    ])
  )

/**
 * The call that installs Smart Sessions as a validator for `execute`, with SessionHook bound to it: Kernel then
 * runs the hook around every Smart Sessions operation, which must come through `executeUserOp`.
 *
 * @internal
 */
export const installSessionsData = (sessions: SessionHook.Sessions): Hex.Hex =>
  encodeInstallModule(
    MODULE_TYPE_VALIDATOR,
    sessions.smartSession,
    validatorInstallData("0x", {
      address: sessions.sessionHook,
      data: SessionHook.installData(sessions.smartSession)
    })
  )

/**
 * Kernel's `initialize` call: the owner's validator as root (the ECDSA validator with the owner's address, or
 * WebAuthnValidator with the passkeys' data), and Smart Sessions with SessionHook installed when given.
 *
 * @internal
 */
export const initData = (options: {
  readonly rootValidator: Hex.Hex
  readonly validatorData: Hex.Hex
  readonly sessions?: SessionHook.Sessions | undefined
}): Hex.Hex =>
  AbiFunction.encodeData(initialize, [
    validatorId(options.rootValidator),
    "0x0000000000000000000000000000000000000000",
    options.validatorData,
    "0x",
    options.sessions === undefined ? [] : [installSessionsData(options.sessions)]
  ])

/**
 * The factory call and counterfactual address of a Kernel account.
 *
 * The account deploys through ZeroDev's FactoryStaker, which forwards to the Kernel factory. The FactoryStaker is staked
 * in the EntryPoint on every chain and the factory is not, and ERC-7562 (STO-022) lets deployment write the ECDSA
 * validator's storage for the account only under a staked factory, so bundlers that enforce it accept the first
 * operation. The address is the same either way: the Kernel factory still runs the CREATE2.
 *
 * @internal
 */
export const deployment = (options: {
  readonly contracts: Contracts
  readonly initData: Hex.Hex
  readonly index: bigint
}): { readonly factory: Hex.Hex; readonly factoryData: Hex.Hex; readonly address: Hex.Hex } => {
  const salt = Hex.fromNumber(options.index, { size: 32 })
  return {
    factory: options.contracts.factoryStaker,
    factoryData: AbiFunction.encodeData(deployWithFactory, [options.contracts.factory, options.initData, salt]),
    // Kernel's factory salts CREATE2 with keccak256(data ‖ salt).
    address: predictAddress({
      factory: options.contracts.factory,
      implementation: options.contracts.implementation,
      salt: Hash.keccak256(Hex.concat(options.initData, salt))
    })
  }
}

/**
 * The owner's nonce key, 24 bytes: mode 0x00 ‖ type 0x00 (root) ‖ the root validator ‖ a 2-byte key of 0. The zero
 * mode and type bytes leave the validator shifted past the 2-byte key.
 *
 * @internal
 */
export const ownerNonceKey = (rootValidator: Hex.Hex): bigint => Hex.toBigInt(rootValidator) << BigInt("16")

/**
 * The digest the owner signs for an ERC-1271 check of `hash`: the hash wrapped as EIP-712 `Kernel(bytes32 hash)` in
 * the account's domain.
 *
 * @internal
 */
export const wrappedHash = (options: {
  readonly hash: Hex.Hex
  readonly account: Hex.Hex
  readonly chainId: number
  readonly version: string
}): Hex.Hex =>
  TypedData.getSignPayload({
    domain: { name: "Kernel", version: options.version, chainId: options.chainId, verifyingContract: options.account },
    types: { Kernel: [{ name: "hash", type: "bytes32" }] },
    primaryType: "Kernel",
    message: { hash: options.hash }
  })

/**
 * Prefixes an owner signature with the validator it is for: the root validator, or `0x00` (the account itself) when
 * the account is an EIP-7702 delegated EOA.
 *
 * @internal
 */
export const ownerSignature = (rootValidator: Hex.Hex, signature: Hex.Hex, eip7702: boolean): Hex.Hex =>
  eip7702 ? Hex.concat("0x00", signature) : Hex.concat(validatorId(rootValidator), signature)

const ecdsaOnInstall = AbiFunction.from("function onInstall(bytes data)")
const ecdsaOnUninstall = AbiFunction.from("function onUninstall(bytes data)")
const ecdsaValidatorStorage = AbiFunction.from("function ecdsaValidatorStorage(address account) view returns (address)")
const rootValidator = AbiFunction.from("function rootValidator() view returns (bytes21)")

/**
 * The nonce key of a validator installed next to the root: mode 0x00 ‖ type 0x01 (validator) ‖ the validator ‖ a
 * 2-byte key of 0.
 *
 * @internal
 */
export const validatorNonceKey = (validator: Hex.Hex): bigint =>
  (BigInt(1) << BigInt(176)) | (Hex.toBigInt(validator) << BigInt(16))

/**
 * The calls (to the ECDSA validator, from the account) that replace its owner: the deployed validator refuses
 * `onInstall` while it holds an owner, and Kernel can't reinstall its root validator, so the account clears the owner
 * and installs the new one in the same operation.
 *
 * @internal
 */
export const replaceEcdsaOwnerData = (owner: Hex.Hex): readonly [Hex.Hex, Hex.Hex] => [
  AbiFunction.encodeData(ecdsaOnUninstall, ["0x"]),
  AbiFunction.encodeData(ecdsaOnInstall, [owner])
]

/** The ECDSA validator's owner view. @internal */
export const encodeEcdsaOwner = (account: Hex.Hex): Hex.Hex => AbiFunction.encodeData(ecdsaValidatorStorage, [account])

/** Decodes the ECDSA validator's owner. @internal */
export const decodeEcdsaOwner = (result: Hex.Hex): Hex.Hex =>
  Address.checksum(AbiFunction.decodeResult(ecdsaValidatorStorage, result))

/** Kernel's `rootValidator()` view. @internal */
export const encodeRootValidator: Hex.Hex = AbiFunction.encodeData(rootValidator)

/**
 * The root validator's address from `rootValidator()`'s validation id (type ‖ address); `undefined` for an EIP-7702
 * account's own key (type 0x00).
 *
 * @internal
 */
export const decodeRootValidator = (result: Hex.Hex): Hex.Hex | undefined => {
  const id = AbiFunction.decodeResult(rootValidator, result)
  return Hex.slice(id, 0, 1) === "0x01" ? Hex.slice(id, 1) : undefined
}

/**
 * The call that installs a validator next to the root, allowed to validate `execute`.
 *
 * @internal
 */
export const installValidatorData = (validator: Hex.Hex, validatorData: Hex.Hex): Hex.Hex =>
  encodeInstallModule(MODULE_TYPE_VALIDATOR, validator, validatorInstallData(validatorData))
