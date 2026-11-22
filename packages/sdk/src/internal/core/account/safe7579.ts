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
 * The Safe `setup` call that adds the Safe7579 adapter through the launchpad, with the owners on OwnableValidator,
 * SmartSession as a second validator when given, and no registry attesters.
 *
 * @internal
 */
export const initializer = (options: {
  readonly contracts: Contracts
  readonly owners: ReadonlyArray<Hex.Hex>
  readonly threshold: bigint
  readonly smartSession?: Hex.Hex | undefined
}): Hex.Hex => {
  const owners = sortOwners(options.owners)
  const ownable = AbiParameters.encode(AbiParameters.from(["uint256", "address[]"]), [options.threshold, owners])
  const modules = [
    { module: options.contracts.ownableValidator, initData: ownable, moduleType: MODULE_TYPE_VALIDATOR },
    ...(options.smartSession === undefined
      ? []
      : [{ module: options.smartSession, initData: "0x" as const, moduleType: MODULE_TYPE_VALIDATOR }])
  ]
  return AbiFunction.encodeData(setup, [
    owners,
    options.threshold,
    options.contracts.launchpad,
    AbiFunction.encodeData(addSafe7579, [options.contracts.adapter, modules, [], 0]),
    options.contracts.adapter,
    "0x0000000000000000000000000000000000000000",
    0n,
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
 * The owners' nonce key: the OwnableValidator address ‖ a 4-byte key of 0.
 *
 * @internal
 */
export const ownerNonceKey = (contracts: Contracts): bigint =>
  Hex.toBigInt(Hex.concat(contracts.ownableValidator, "0x00000000"))

/**
 * Concatenates owner signatures, as OwnableValidator reads them in a user operation (the nonce key selects it).
 *
 * @internal
 */
export const concatSignatures = (signatures: ReadonlyArray<Hex.Hex>): Hex.Hex => Hex.concat(...signatures)

/**
 * Prefixes owner signatures for ERC-1271 with the validator they are for, OwnableValidator.
 *
 * @internal
 */
export const ownerSignature = (contracts: Contracts, signatures: ReadonlyArray<Hex.Hex>): Hex.Hex =>
  Hex.concat(contracts.ownableValidator, ...signatures)
