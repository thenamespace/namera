import * as AbiFunction from "ox/AbiFunction"
import * as Base64 from "ox/Base64"
import * as Bytes from "ox/Bytes"
import * as Hex from "ox/Hex"

import { compile, type Contracts } from "../session/compile.ts"
import type { Session } from "../session/session.ts"
import { compress, decompress } from "./fastLz.ts"
import type { ChainEntry } from "./typedData.ts"

/**
 * One chain of a grant: its CAIP-2 id, the contracts the session compiles to there, the enable nonce the owner
 * signed, the chain's session digest, and the owner's ERC-1271 signature on that chain.
 */
export interface GrantChain {
  readonly chain: `eip155:${number}`
  readonly contracts: Contracts
  readonly nonce: bigint
  readonly sessionDigest: Hex.Hex
  readonly signature: Hex.Hex
}

/**
 * The account a grant is for: its type and version, and the factory call that deploys it while it is undeployed.
 */
export interface GrantAccountType {
  readonly type: "kernel" | "nexus" | "safe7579"
  readonly version: string
  readonly deployment?: { readonly factory: Hex.Hex; readonly factoryData: Hex.Hex } | undefined
}

/**
 * A grant, version 1: one session, signed by the owner of one account, on one or more chains. It never holds a
 * secret: the session names the agent's public keys only.
 */
export interface Grant {
  readonly version: 1
  readonly namespace: "eip155"
  readonly id: Hex.Hex
  readonly account: `eip155:${number}:${string}`
  readonly accountType: GrantAccountType
  readonly session: Session
  readonly chains: ReadonlyArray<GrantChain>
  readonly summary: ReadonlyArray<string>
}

/**
 * The token's prefix: Namera, version 1.
 *
 * @internal
 */
export const TOKEN_PREFIX = "nmr1_"

/** @internal */
export const chainId = (caip2: `eip155:${number}`): number => Number(caip2.slice("eip155:".length))

/** @internal */
export const caip2 = (id: number): `eip155:${number}` => `eip155:${id}`

/**
 * The account's address, from its CAIP-10 id.
 *
 * @internal
 */
export const accountAddress = (grant: Pick<Grant, "account">): Hex.Hex =>
  grant.account.slice(grant.account.lastIndexOf(":") + 1) as Hex.Hex

/**
 * The grant's chains as the digests take them: each chain's compiled session with its own contracts.
 *
 * @internal
 */
export const entries = (grant: Pick<Grant, "account" | "session" | "chains">): ReadonlyArray<ChainEntry> =>
  grant.chains.map((entry) => ({
    chainId: chainId(entry.chain),
    account: accountAddress(grant),
    compiled: compile(grant.session, entry.contracts),
    smartSession: entry.contracts.smartSession,
    nonce: entry.nonce
  }))

const getNonce = AbiFunction.from("function getNonce(bytes32 permissionId, address account) view returns (uint256)")

/** Smart Sessions' enable nonce of a session on an account. @internal */
export const encodeGetNonce = (permissionId: Hex.Hex, account: Hex.Hex): Hex.Hex =>
  AbiFunction.encodeData(getNonce, [permissionId, account])

/** @internal */
export const decodeGetNonce = (result: Hex.Hex): bigint => AbiFunction.decodeResult(getNonce, result)

// JSON with bigints tagged as `{ "$n": "123" }`: unambiguous, since no policy has a `$n` field.
const BIGINT = "$n"

/**
 * The grant as canonical JSON: keys sorted, undefined fields dropped, bigints tagged.
 *
 * @internal
 */
export const toJson = (grant: Grant): string =>
  JSON.stringify(grant, (_, value: unknown) => {
    if (typeof value === "bigint") return { [BIGINT]: value.toString() }
    if (typeof value !== "object" || value === null || Array.isArray(value)) return value
    return Object.fromEntries(
      Object.entries(value).filter(([, field]) => field !== undefined).sort(([a], [b]) => (a < b ? -1 : 1))
    )
  })

/**
 * Parses JSON written by `toJson`, reviving tagged bigints. Throws on text that isn't JSON.
 *
 * @internal
 */
export const fromJson = (text: string): unknown =>
  JSON.parse(text, (_, value: unknown) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return value
    const keys = Object.keys(value)
    const tagged = (value as Record<string, unknown>)[BIGINT]
    return keys.length === 1 && typeof tagged === "string" && /^-?\d+$/.test(tagged) ? BigInt(tagged) : value
  })

/**
 * The compact token: `nmr1_` and the canonical JSON, FastLZ-compressed (about 2.3× smaller; synchronous and without a
 * dependency, unlike deflate), in base64url without padding.
 *
 * @internal
 */
export const toToken = (grant: Grant): string =>
  `${TOKEN_PREFIX}${
    Base64.fromBytes(Bytes.fromHex(compress(Hex.fromString(toJson(grant)))), { url: true, pad: false })
  }`

/**
 * The JSON inside a token, or `undefined` for text that isn't one.
 *
 * @internal
 */
export const tokenJson = (token: string): string | undefined => {
  if (!token.startsWith(TOKEN_PREFIX)) return undefined
  const body = token.slice(TOKEN_PREFIX.length)
  if (body.length === 0 || !/^[A-Za-z0-9_-]*$/.test(body)) return undefined
  try {
    return Hex.toString(decompress(Hex.fromBytes(Base64.toBytes(body))))
  } catch {
    return undefined
  }
}
