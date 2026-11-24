import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Hex from "ox/Hex"

import { holds } from "./evaluate/evaluate.ts"
import { resolve } from "./session/resolve.ts"
import type { Session } from "./session/session.ts"

// Circle's USDC paymaster for EntryPoint 0.7: no API, the account signs an EIP-2612 permit of USDC to the paymaster,
// which takes the gas cost in USDC during validation and refunds the rest in postOp.

/**
 * How sure Namera is of a chain's entry: `live` was used end to end by Namera's live tests; `code` has the
 * paymaster's code on chain (checked with `eth_getCode`) and Circle's published USDC address, but no operation yet.
 *
 * @internal
 */
export type Evidence = "live" | "code"

/**
 * Circle's v0.7 paymaster and USDC on one chain.
 *
 * @internal
 */
export interface CircleChain {
  readonly paymaster: Hex.Hex
  readonly usdc: Hex.Hex
  readonly evidence: Evidence
}

const testnet = "0x31BE08D380A21fc740883c0BC434FcFc88740b58"
const mainnet = "0x6C973eBe80dCD8660841D4356bf15c32460271C9"

/**
 * Circle's v0.7 paymaster on Namera's launch chains, by chain id. OP Sepolia has only Circle's v0.8 paymaster, which
 * needs EntryPoint 0.8. Sources: Namera's live tests (Base Sepolia, 2026-11-15), `eth_getCode` scans (2026-11-15) and
 * Circle's published addresses (`developers.circle.com/paymaster/addresses-and-events`).
 *
 * @internal
 */
export const circleChains: { readonly [chainId: number]: CircleChain } = {
  84532: { paymaster: testnet, usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", evidence: "live" },
  11155111: { paymaster: testnet, usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", evidence: "code" },
  421614: { paymaster: testnet, usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", evidence: "code" },
  8453: { paymaster: mainnet, usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", evidence: "code" }
}

/**
 * The paymaster gas Circle's paymaster needs: the permit and the transfer in validation, the refund in postOp.
 *
 * @internal
 */
export const circleGas = { verification: BigInt(200_000), postOp: BigInt(50_000) } as const

/**
 * The most USDC (6 decimals) one ether of gas is priced at when sizing the permit: a ceiling well above the market,
 * so the permit always covers what the paymaster takes (it charges the real cost and refunds the rest).
 *
 * @internal
 */
export const USDC_PER_ETH_CEILING = BigInt(20_000_000_000)

const WEI_PER_ETH = BigInt(10) ** BigInt(18)

/**
 * The USDC to permit for an operation that may cost `maxCost` wei: its price at the ceiling plus 20%, rounded up,
 * and at most `maxAmount`.
 *
 * @internal
 */
export const permitAmount = (maxCost: bigint, maxAmount: bigint): bigint => {
  const usdc = (maxCost * USDC_PER_ETH_CEILING + WEI_PER_ETH - BigInt(1)) / WEI_PER_ETH
  const withMargin = (usdc * BigInt(12) + BigInt(9)) / BigInt(10)
  return withMargin < maxAmount ? withMargin : maxAmount
}

/**
 * The paymaster data Circle's v0.7 paymaster reads: mode 0 (permit), the token, the permitted amount and the
 * permit's signature, packed.
 *
 * @internal
 */
export const circlePaymasterData = (options: {
  readonly token: Hex.Hex
  readonly amount: bigint
  readonly signature: Hex.Hex
}): Hex.Hex =>
  AbiParameters.encodePacked(["uint8", "address", "uint256", "bytes"], [
    0,
    options.token,
    options.amount,
    options.signature
  ])

const permitTypes = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
} as const

const MAX_UINT256 = BigInt(2) ** BigInt(256) - BigInt(1)

/**
 * The EIP-2612 permit the account signs: `value` USDC to the paymaster, without a deadline (as Circle's own
 * integration does).
 *
 * @internal
 */
export const permitTypedData = (options: {
  readonly token: { readonly address: Hex.Hex; readonly name: string; readonly version: string }
  readonly chainId: number
  readonly owner: Hex.Hex
  readonly spender: Hex.Hex
  readonly value: bigint
  readonly nonce: bigint
}) => ({
  domain: {
    name: options.token.name,
    version: options.token.version,
    chainId: options.chainId,
    verifyingContract: options.token.address
  },
  types: permitTypes,
  primaryType: "Permit" as const,
  message: {
    owner: options.owner,
    spender: options.spender,
    value: options.value,
    nonce: options.nonce,
    deadline: MAX_UINT256
  }
})

const same = (a: unknown, b: string) => typeof a === "string" && a.toLowerCase() === b.toLowerCase()

/**
 * Whether the session lets its key sign Circle's USDC permit: a `Policy.signTypedData` of `Permit` on the chain's
 * USDC (any launch chain's, without `chainId`) whose `spender` condition, if any, allows Circle's paymaster.
 *
 * @internal
 */
export const allowsCirclePermit = (session: Session, chainId?: number | undefined): boolean => {
  const chains = chainId === undefined
    ? Object.entries(circleChains).map(([id, chain]) => [Number(id), chain] as const)
    : circleChains[chainId] === undefined
    ? []
    : [[chainId, circleChains[chainId]!] as const]
  const resolved = resolve(session.policies)
  const signatures = "resolved" in resolved ? resolved.resolved.signatures : []

  return session.policies.some((policy, index) => {
    if (policy.type !== "signTypedData" || policy.primaryType !== "Permit") return false
    const domainChain = policy.domain?.chainId === undefined ? undefined : Number(policy.domain.chainId)
    return chains.some(([id, chain]) => {
      if (!same(policy.domain?.verifyingContract, chain.usdc)) return false
      if (domainChain !== undefined && domainChain !== id) return false
      const spender = signatures.find((signature) => signature.source === index)?.fields.find((rule) =>
        rule.field === "spender"
      )
      return spender === undefined
        || holds(spender.comparison.operator, spender.comparison.refs, Hex.toBigInt(chain.paymaster))
    })
  })
}

const tokenName = AbiFunction.from("function name() view returns (string)")
const tokenVersion = AbiFunction.from("function version() view returns (string)")
const tokenNonces = AbiFunction.from("function nonces(address owner) view returns (uint256)")

/**
 * The calls that read what a permit's domain and message need from the token: its name, version and the owner's
 * permit nonce, with their decoders.
 *
 * @internal
 */
export const permitReads = (owner: Hex.Hex) => ({
  name: {
    data: AbiFunction.encodeData(tokenName),
    decode: (result: Hex.Hex): string => AbiFunction.decodeResult(tokenName, result)
  },
  version: {
    data: AbiFunction.encodeData(tokenVersion),
    decode: (result: Hex.Hex): string => AbiFunction.decodeResult(tokenVersion, result)
  },
  nonce: {
    data: AbiFunction.encodeData(tokenNonces, [owner]),
    decode: (result: Hex.Hex): bigint => AbiFunction.decodeResult(tokenNonces, result)
  }
})
