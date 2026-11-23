import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"
import * as TypedData from "ox/TypedData"

import { predictAddress } from "./erc1967.ts"
import { encodeInstallModule, MODULE_TYPE_VALIDATOR } from "./erc7579.ts"

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
 * The validator install data Kernel expects: hook (`address(1)`, none) ‖ `abi.encode(validatorData, hookData,
 * selectorData)`, granting the validator `execute`.
 *
 * @internal
 */
export const validatorInstallData = (validatorData: Hex.Hex): Hex.Hex =>
  Hex.concat(
    "0x0000000000000000000000000000000000000001",
    AbiParameters.encode(AbiParameters.from(["bytes", "bytes", "bytes"]), [validatorData, "0x", EXECUTE])
  )

/**
 * Kernel's `initialize` call: the ECDSA validator as root for `owner`, and SmartSession installed when given.
 *
 * @internal
 */
export const initData = (options: {
  readonly contracts: Contracts
  readonly owner: Hex.Hex
  readonly smartSession?: Hex.Hex | undefined
}): Hex.Hex =>
  AbiFunction.encodeData(initialize, [
    validatorId(options.contracts.ecdsaValidator),
    "0x0000000000000000000000000000000000000000",
    options.owner,
    "0x",
    options.smartSession === undefined
      ? []
      : [encodeInstallModule(MODULE_TYPE_VALIDATOR, options.smartSession, validatorInstallData("0x"))]
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
export const ownerNonceKey = (contracts: Contracts): bigint => Hex.toBigInt(contracts.ecdsaValidator) << BigInt("16")

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
 * Prefixes an owner signature with the validator it is for: the ECDSA validator, or `0x00` (the account itself)
 * when the account is an EIP-7702 delegated EOA.
 *
 * @internal
 */
export const ownerSignature = (contracts: Contracts, signature: Hex.Hex, eip7702: boolean): Hex.Hex =>
  eip7702 ? Hex.concat("0x00", signature) : Hex.concat(validatorId(contracts.ecdsaValidator), signature)
