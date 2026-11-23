/**
 * The Effect form of `Key`: a key's addresses on each chain namespace, failing in the error channel.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Effect from "effect/Effect"

import * as internal from "../../keys/internal/key.ts"
import * as Key_ from "../../keys/Key.ts"
import type * as KeystoreError from "../../keys/KeystoreError.ts"

/**
 * A key's curve.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Curve = Key_.Curve

/**
 * A chain namespace (CAIP-2) a key may have an address on.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Namespace = Key_.Namespace

/**
 * A key a store holds. The private key never leaves the store.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Key = Key_.Key

/**
 * Checks whether a value is a `Key`.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isKey: (u: unknown) => u is Key = Key_.isKey

/**
 * Returns the key's address on a chain namespace.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const address = (key: Key, namespace: Namespace): Effect.Effect<`0x${string}`, KeystoreError.KeystoreError> =>
  Effect.fromResult(internal.address(key, namespace))

/**
 * Returns the key's CAIP-10 account id on a chain, such as `eip155:8453:0x…`.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const caip10 = (
  key: Key,
  chain: `${Namespace}:${string}`
): Effect.Effect<string, KeystoreError.KeystoreError> => Effect.fromResult(internal.caip10(key, chain))
