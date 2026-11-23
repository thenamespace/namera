import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Address from "ox/Address"
import * as ContractAddress from "ox/ContractAddress"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"

import { MODULE_TYPE_VALIDATOR } from "./erc7579.ts"

/** The contracts of one Safe7579 version. @internal */
export interface Contracts {
  readonly proxyFactory: Hex.Hex
  readonly singletonL2: Hex.Hex
  readonly adapter: Hex.Hex
  readonly launchpad: Hex.Hex
  readonly ownableValidator: Hex.Hex
}

const addSafe7579 = AbiFunction.from(
  "function addSafe7579(address safe7579, (address module, bytes initData, uint256 moduleType)[] modules, address[] attesters, uint8 threshold)"
)
const setup = AbiFunction.from(
  "function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)"
)
const createProxyWithNonce = AbiFunction.from(
  "function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address)"
)

// `SafeProxyFactory.proxyCreationCode()` of Safe 1.4.1, whose CREATE2 initcode is this code ‖ abi.encode(singleton).
const proxyCreationCode =
  "0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea264697066735822122003d1488ee65e08fa41e58e888a9865554c535f2c77126a82cb4c0f917f31441364736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564"

/**
 * Owner addresses in ascending order, as OwnableValidator requires them at install.
 *
 * @internal
 */
export const sortOwners = (owners: ReadonlyArray<Hex.Hex>): ReadonlyArray<Hex.Hex> =>
  // Stryker disable next-line EqualityOperator: owners are distinct, so `<` and `<=` order them the same
  [...owners].sort((a, b) => (Hex.toBigInt(a) < Hex.toBigInt(b) ? -1 : 1))

/**
 * Who owns a Safe7579 account: owner addresses on OwnableValidator (also the Safe's own owners), or a validator module
 * installed with its data (Namera's `WebAuthnValidator` for passkeys).
 *
 * @internal
 */
export type Owner =
  | { readonly type: "ownable"; readonly owners: ReadonlyArray<Hex.Hex>; readonly threshold: bigint }
  | { readonly type: "module"; readonly validator: Hex.Hex; readonly data: Hex.Hex }

/**
 * The Safe owner of an account whose owner is a validator module. A Safe needs at least one owner; this one is an
 * address derived from a hash, so no key signs for it and the Safe's own `execTransaction` path stays closed.
 *
 * @internal
 */
export const moduleOwnedSafeOwner: Hex.Hex = Address.checksum(
  Hex.slice(Hash.keccak256(Hex.fromString("namera.safe7579.module-owned")), 12)
)

/**
 * The Safe `setup` call that adds the Safe7579 adapter through the launchpad, with the owner's validator (OwnableValidator
 * or a module), SmartSession as a second validator when given, and no registry attesters.
 *
 * @internal
 */
export const initializer = (options: {
  readonly contracts: Contracts
  readonly owner: Owner
  readonly smartSession?: Hex.Hex | undefined
}): Hex.Hex => {
  const { owner } = options
  const safeOwners = owner.type === "ownable" ? sortOwners(owner.owners) : [moduleOwnedSafeOwner]
  const safeThreshold = owner.type === "ownable" ? owner.threshold : BigInt(1)
  const validator = owner.type === "ownable"
    ? {
      module: options.contracts.ownableValidator,
      initData: AbiParameters.encode(AbiParameters.from(["uint256", "address[]"]), [owner.threshold, safeOwners]),
      moduleType: MODULE_TYPE_VALIDATOR
    }
    : { module: owner.validator, initData: owner.data, moduleType: MODULE_TYPE_VALIDATOR }
  const modules = [
    validator,
    ...(options.smartSession === undefined
      ? []
      : [{ module: options.smartSession, initData: "0x" as const, moduleType: MODULE_TYPE_VALIDATOR }])
  ]
  return AbiFunction.encodeData(setup, [
    safeOwners,
    safeThreshold,
    options.contracts.launchpad,
    AbiFunction.encodeData(addSafe7579, [options.contracts.adapter, modules, [], 0]),
    options.contracts.adapter,
    "0x0000000000000000000000000000000000000000",
    // Stryker disable next-line StringLiteral: BigInt("") is 0 too
    BigInt("0"),
    "0x0000000000000000000000000000000000000000"
  ])
}

/** The factory call and counterfactual address of a Safe7579 account. @internal */
export const deployment = (options: {
  readonly contracts: Contracts
  readonly initializer: Hex.Hex
  readonly index: bigint
}): { readonly factoryData: Hex.Hex; readonly address: Hex.Hex } => ({
  factoryData: AbiFunction.encodeData(createProxyWithNonce, [
    options.contracts.singletonL2,
    options.initializer,
    options.index
  ]),
  address: Address.checksum(ContractAddress.fromCreate2({
    from: options.contracts.proxyFactory,
    salt: Hash.keccak256(Hex.concat(Hash.keccak256(options.initializer), Hex.fromNumber(options.index, { size: 32 }))),
    bytecodeHash: Hash.keccak256(
      Hex.concat(
        proxyCreationCode,
        AbiParameters.encode(AbiParameters.from(["address"]), [options.contracts.singletonL2])
      )
    )
  }))
})

/**
 * The nonce key that selects a validator: its address ‖ a 4-byte key of 0.
 *
 * @internal
 */
export const validatorNonceKey = (validator: Hex.Hex): bigint => Hex.toBigInt(Hex.concat(validator, "0x00000000"))

/**
 * Concatenates owner signatures, as OwnableValidator reads them in a user operation (the nonce key selects it).
 *
 * @internal
 */
export const concatSignatures = (signatures: ReadonlyArray<Hex.Hex>): Hex.Hex => Hex.concat(...signatures)

/**
 * Prefixes an owner signature for ERC-1271 with the validator it is for.
 *
 * @internal
 */
export const ownerSignature = (validator: Hex.Hex, signature: Hex.Hex): Hex.Hex => Hex.concat(validator, signature)

const SENTINEL: Hex.Hex = "0x0000000000000000000000000000000000000001"

const ownableAddOwner = AbiFunction.from("function addOwner(address owner)")
const ownableRemoveOwner = AbiFunction.from("function removeOwner(address prevOwner, address owner)")
const ownableSetThreshold = AbiFunction.from("function setThreshold(uint256 threshold)")
const ownableGetOwners = AbiFunction.from("function getOwners(address account) view returns (address[])")
const ownableThreshold = AbiFunction.from("function threshold(address account) view returns (uint256)")
const safeAddOwner = AbiFunction.from("function addOwnerWithThreshold(address owner, uint256 threshold)")
const safeRemoveOwner = AbiFunction.from("function removeOwner(address prevOwner, address owner, uint256 threshold)")
const safeSwapOwner = AbiFunction.from("function swapOwner(address prevOwner, address oldOwner, address newOwner)")
const safeChangeThreshold = AbiFunction.from("function changeThreshold(uint256 threshold)")
const safeGetOwners = AbiFunction.from("function getOwners() view returns (address[])")

/**
 * The owner before `owner` in a sentinel-linked owner list (OwnableValidator's and the Safe's), as their removal
 * functions take it: the sentinel for the first owner.
 *
 * @internal
 */
export const previousOwner = (owners: ReadonlyArray<Hex.Hex>, owner: Hex.Hex): Hex.Hex | undefined => {
  const index = owners.findIndex((candidate) => Hex.toBigInt(candidate) === Hex.toBigInt(owner))
  // Stryker disable next-line ConditionalExpression: without it, owners[-2] is undefined too; kept for clarity
  if (index === -1) return undefined
  return index === 0 ? SENTINEL : owners[index - 1]
}

/** OwnableValidator's owner management calls. @internal */
export const ownable = {
  addOwner: (owner: Hex.Hex): Hex.Hex => AbiFunction.encodeData(ownableAddOwner, [owner]),
  removeOwner: (previous: Hex.Hex, owner: Hex.Hex): Hex.Hex =>
    AbiFunction.encodeData(ownableRemoveOwner, [previous, owner]),
  setThreshold: (threshold: number): Hex.Hex => AbiFunction.encodeData(ownableSetThreshold, [BigInt(threshold)]),
  encodeOwners: (account: Hex.Hex): Hex.Hex => AbiFunction.encodeData(ownableGetOwners, [account]),
  decodeOwners: (result: Hex.Hex): ReadonlyArray<Hex.Hex> => AbiFunction.decodeResult(ownableGetOwners, result),
  encodeThreshold: (account: Hex.Hex): Hex.Hex => AbiFunction.encodeData(ownableThreshold, [account]),
  decodeThreshold: (result: Hex.Hex): number => Number(AbiFunction.decodeResult(ownableThreshold, result)),
  installData: (owners: ReadonlyArray<Hex.Hex>, threshold: number): Hex.Hex =>
    AbiParameters.encode(AbiParameters.from(["uint256", "address[]"]), [BigInt(threshold), sortOwners(owners)])
}

/** The Safe's own owner management calls, which a key-owned Safe7579 keeps in step with OwnableValidator. @internal */
export const safe = {
  addOwner: (owner: Hex.Hex, threshold: number): Hex.Hex =>
    AbiFunction.encodeData(safeAddOwner, [owner, BigInt(threshold)]),
  removeOwner: (previous: Hex.Hex, owner: Hex.Hex, threshold: number): Hex.Hex =>
    AbiFunction.encodeData(safeRemoveOwner, [previous, owner, BigInt(threshold)]),
  swapOwner: (previous: Hex.Hex, oldOwner: Hex.Hex, newOwner: Hex.Hex): Hex.Hex =>
    AbiFunction.encodeData(safeSwapOwner, [previous, oldOwner, newOwner]),
  changeThreshold: (threshold: number): Hex.Hex => AbiFunction.encodeData(safeChangeThreshold, [BigInt(threshold)]),
  encodeOwners: AbiFunction.encodeData(safeGetOwners),
  decodeOwners: (result: Hex.Hex): ReadonlyArray<Hex.Hex> => AbiFunction.decodeResult(safeGetOwners, result)
}
