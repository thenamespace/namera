/**
 * Keys as values: the public half of a key a `Keystore` holds, and its addresses on each chain namespace.
 *
 * **Details**
 *
 * Keys are stored by curve and addressed per chain namespace (CAIP-2), so one store can hold keys for every chain
 * Namera supports. Today `eip155` (EVM) addresses are supported for secp256k1 keys; `tron` and `solana` are reserved.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Predicate from "effect/Predicate"
import * as Result from "effect/Result"

import type { Curve as Curve_ } from "../internal/core/key/key.ts"
import * as internal from "./internal/key.ts"
import type * as KeystoreError from "./KeystoreError.ts"

/**
 * A key's curve: `secp256k1` (EVM, later Tron), `ed25519` (later Solana) or `p256` (passkeys and WebCrypto).
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Curve = Curve_

/**
 * A chain namespace (CAIP-2) a key may have an address on.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Namespace = internal.Namespace

/**
 * A key a store holds: its id and label, curve, public key (uncompressed for secp256k1 and p256, 32 bytes for
 * ed25519) and creation time in seconds. The private key never leaves the store.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Key = internal.Key

const curves: ReadonlyArray<unknown> = ["secp256k1", "ed25519", "p256"]

/**
 * Checks whether a value is a `Key`.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isKey = (u: unknown): u is Key =>
  Predicate.hasProperty(u, "id") && Predicate.isString(u.id)
  && Predicate.hasProperty(u, "curve") && curves.includes(u.curve)
  && Predicate.hasProperty(u, "publicKey") && Predicate.isString(u.publicKey) && u.publicKey.startsWith("0x")
  && Predicate.hasProperty(u, "createdAt") && Predicate.isNumber(u.createdAt)

/**
 * Returns the key's address on a chain namespace.
 *
 * **Gotchas**
 *
 * Throws `KeystoreError` (`CurveUnsupported`) for an `eip155` address of a key that is not secp256k1, and
 * (`NamespaceUnsupported`) for `tron` and `solana` until they are supported.
 *
 * **Example** (The EVM address of a key)
 *
 * ```ts
 * import { Key, Keystore } from "@namera-ai/sdk"
 *
 * const store = Keystore.memory()
 * const key = await Keystore.create(store, { curve: "secp256k1" })
 * const address = Key.address(key, "eip155")
 * ```
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export function address(key: Key, namespace: Namespace): address.ReturnType {
  return Result.getOrThrow(internal.address(key, namespace))
}

/**
 * Types of `Key.address`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace address {
  /**
   * The address: checksummed hex on `eip155`.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ReturnType = `0x${string}`
  /**
   * The errors `Key.address` can throw.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = KeystoreError.KeystoreError
}

/**
 * Returns the key's CAIP-10 account id on a chain, such as `eip155:8453:0x…`.
 *
 * **Gotchas**
 *
 * Throws the same `KeystoreError`s as `Key.address`.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export function caip10(key: Key, chain: `${Namespace}:${string}`): string {
  return Result.getOrThrow(internal.caip10(key, chain))
}

/**
 * Types of `Key.caip10`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace caip10 {
  /**
   * The errors `Key.caip10` can throw.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = KeystoreError.KeystoreError
}
