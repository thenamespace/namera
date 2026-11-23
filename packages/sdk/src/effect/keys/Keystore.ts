/**
 * The Effect form of `Keystore`: where an agent's keys live and sign, with failures in the error channel.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Effect from "effect/Effect"

import type { Curve } from "../../internal/core/key/key.ts"
import * as internal from "../../internal/keystore.ts"
import type { LocalAccount } from "../../internal/viem/account.ts"
import type { Key } from "../../keys/Key.ts"
import type * as Keystore_ from "../../keys/Keystore.ts"
import type * as KeystoreError from "../../keys/KeystoreError.ts"

/**
 * A key store.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Keystore = Keystore_.Keystore

/**
 * How `encryptedJson` derives its encryption key from the password.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Kdf = Keystore_.Kdf

/**
 * Checks whether a value is a `Keystore`.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isKeystore: (u: unknown) => u is Keystore = internal.isStore

/**
 * A store that keeps keys in memory for the process's lifetime, on every curve.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const memory: () => Keystore = internal.memory

/**
 * A store that encrypts each key with a password, on every curve, in any runtime. Fails with `KeystoreError`
 * (`Unavailable`) when `data` is not an export of this store.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const encryptedJson = (
  options: Keystore_.encryptedJson.Options
): Effect.Effect<Keystore, KeystoreError.KeystoreError> => Effect.fromResult(internal.encryptedJson(options))

/**
 * A store on your own backend, whose operations return Effects.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const from: (backend: {
  readonly curves: ReadonlyArray<Curve>
  readonly create: (options: {
    readonly curve: Curve
    readonly label?: string | undefined
  }) => Effect.Effect<Key, KeystoreError.KeystoreError>
  readonly get: (id: string) => Effect.Effect<Key, KeystoreError.KeystoreError>
  readonly list: Effect.Effect<ReadonlyArray<Key>, KeystoreError.KeystoreError>
  readonly remove: (id: string) => Effect.Effect<void, KeystoreError.KeystoreError>
  readonly sign: (id: string, digest: `0x${string}`) => Effect.Effect<`0x${string}`, KeystoreError.KeystoreError>
}) => Keystore = internal.fromEffects

/**
 * Creates a key on a curve, and returns it.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const create = (
  store: Keystore,
  options: { readonly curve: Curve; readonly label?: string | undefined }
): Effect.Effect<Key, KeystoreError.KeystoreError> => store.create(options)

/**
 * Returns a key by id.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const get = (
  store: Keystore,
  options: { readonly id: string }
): Effect.Effect<Key, KeystoreError.KeystoreError> => store.get(options.id)

/**
 * Returns every key in the store.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const list = (store: Keystore): Effect.Effect<ReadonlyArray<Key>, KeystoreError.KeystoreError> => store.list

/**
 * Removes a key from the store.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const remove = (
  store: Keystore,
  options: { readonly id: string }
): Effect.Effect<void, KeystoreError.KeystoreError> => store.remove(options.id)

/**
 * Signs a 32-byte digest with a key, as it is.
 *
 * @stability experimental
 * @category signing
 * @since 2.0.0
 */
export const sign = (
  store: Keystore,
  options: { readonly id: string; readonly digest: `0x${string}` }
): Effect.Effect<`0x${string}`, KeystoreError.KeystoreError> => store.sign(options.id, options.digest)

/**
 * Returns a viem account that signs with a secp256k1 key in the store.
 *
 * @stability experimental
 * @category conversions
 * @since 2.0.0
 */
export const toAccount = (
  store: Keystore,
  options: { readonly id: string }
): Effect.Effect<LocalAccount, KeystoreError.KeystoreError> => internal.toAccount(store, options.id)

/**
 * Exports an `encryptedJson` store as JSON.
 *
 * @stability experimental
 * @category conversions
 * @since 2.0.0
 */
export const toJson: (store: Keystore) => Effect.Effect<string, KeystoreError.KeystoreError> = internal.toJson
