import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"
import * as TypedData from "ox/TypedData"

// Session-key ERC-1271 signatures (contracts/src/smart-sessions/core/SmartSessionERC7739.sol): the session key signs
// the app's typed data nested in ERC-7739's `TypedDataSign` under the account's EIP-712 domain, and the signature
// carries the struct's `encodeData` so signing policies can check its fields.

/**
 * An account's EIP-712 domain, as ERC-5267's `eip712Domain()` returns it.
 *
 * @internal
 */
export interface AccountDomain {
  readonly name: string
  readonly version: string
  readonly chainId: bigint
  readonly verifyingContract: Hex.Hex
  readonly salt: Hex.Hex
}

const eip712Domain = AbiFunction.from(
  "function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)"
)

/** @internal */
export const encodeEip712Domain: Hex.Hex = AbiFunction.encodeData(eip712Domain)

/** @internal */
export const decodeEip712Domain = (result: Hex.Hex): AccountDomain => {
  const [, name, version, chainId, verifyingContract, salt] = AbiFunction.decodeResult(eip712Domain, result)
  return { name, version, chainId, verifyingContract, salt }
}

/**
 * App typed data, as viem's `signTypedData` takes it.
 *
 * @internal
 */
export interface AppTypedData {
  readonly domain?: TypedData.Domain | undefined
  readonly types: { readonly [name: string]: ReadonlyArray<{ readonly name: string; readonly type: string }> }
  readonly primaryType: string
  readonly message: { readonly [field: string]: unknown }
}

const domainFields = AbiParameters.from(["bytes32", "bytes32", "bytes32", "bytes32", "uint256", "address", "bytes32"])

/**
 * The app's typed data nested for the account: the digest the session key signs, and the parts Smart Sessions reads
 * back from the signature.
 *
 * @internal
 */
export const nest = (typedData: AppTypedData, domain: AccountDomain) => {
  const { EIP712Domain: _, ...types } = typedData.types as Record<string, ReadonlyArray<TypedData.Parameter>>
  const appDomain = typedData.domain ?? {}
  const definition = { types: types as TypedData.TypedData, primaryType: typedData.primaryType }
  const appDomainSeparator = TypedData.hashDomain({ domain: appDomain })
  const contentsType = TypedData.encodeType(definition)
  const contentsData = TypedData.encodeData({ ...definition, data: typedData.message as never })
  const contents = Hash.keccak256(contentsData)
  const typedDataSignTypeHash = Hash.keccak256(Hex.fromString(
    `TypedDataSign(${typedData.primaryType} contents,string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)${contentsType}`
  ))
  const structHash = Hash.keccak256(AbiParameters.encode(domainFields, [
    typedDataSignTypeHash,
    contents,
    Hash.keccak256(Hex.fromString(domain.name)),
    Hash.keccak256(Hex.fromString(domain.version)),
    domain.chainId,
    domain.verifyingContract,
    domain.salt
  ]))
  return {
    /** The digest the session key signs. */
    digest: Hash.keccak256(Hex.concat("0x1901", appDomainSeparator, structHash)),
    /** What the app asks the account about: the typed data's own hash. */
    hash: Hash.keccak256(Hex.concat("0x1901", appDomainSeparator, contents)),
    appDomainSeparator,
    contentsType,
    contentsData
  }
}

/**
 * The signature Smart Sessions reads, `permissionId ‖ sessionKeySignature ‖ contentsData ‖ policyData ‖
 * uint16(contentsData.length) ‖ uint16(policyData.length) ‖ appDomainSeparator ‖ contents ‖ contentsType ‖
 * uint16(contentsType.length)` (no policy data), prefixed with Smart Sessions' Kernel validator id.
 *
 * @internal
 */
export const encodeSignature = (options: {
  readonly smartSession: Hex.Hex
  readonly permissionId: Hex.Hex
  readonly sessionKeySignature: Hex.Hex
  readonly nested: ReturnType<typeof nest>
}): Hex.Hex => {
  const { nested } = options
  const contentsType = Hex.fromString(nested.contentsType)
  return Hex.concat(
    Hex.concat("0x01", options.smartSession),
    options.permissionId,
    options.sessionKeySignature,
    nested.contentsData,
    Hex.fromNumber(Hex.size(nested.contentsData), { size: 2 }),
    "0x0000",
    nested.appDomainSeparator,
    Hash.keccak256(nested.contentsData),
    contentsType,
    Hex.fromNumber(Hex.size(contentsType), { size: 2 })
  )
}
