import * as Result from "effect/Result"

import { type Curve, evmAddress } from "../../internal/core/key/key.ts"
import * as KeystoreError from "../KeystoreError.ts"

/** A chain namespace (CAIP-2) whose addresses a key may have. */
export type Namespace = "eip155" | "tron" | "solana"

/** A key a store holds: its public half and what the store knows about it. The private key never leaves the store. */
export interface Key {
  readonly id: string
  readonly label: string | undefined
  readonly curve: Curve
  readonly publicKey: `0x${string}`
  readonly createdAt: number
}

/** The key's address on a namespace. @internal */
export const address = (key: Key, namespace: Namespace): Result.Result<`0x${string}`, KeystoreError.KeystoreError> => {
  if (namespace !== "eip155") return Result.fail(KeystoreError.namespaceUnsupported({ namespace }))
  if (key.curve !== "secp256k1") {
    return Result.fail(KeystoreError.curveUnsupported({ curve: key.curve, supported: ["secp256k1"] }))
  }
  return Result.succeed(evmAddress(key.publicKey))
}

/** The key's CAIP-10 account id on a chain (`eip155:8453:0x…`). @internal */
export const caip10 = (
  key: Key,
  chain: `${Namespace}:${string}`
): Result.Result<string, KeystoreError.KeystoreError> => {
  const [namespace] = chain.split(":") as [Namespace]
  return Result.map(address(key, namespace), (address) => `${chain}:${address}`)
}
