/**
 * Key stores: where an agent's keys live and sign. Private keys never leave the store; signatures come out.
 *
 * **Details**
 *
 * A store is a value; the module's functions act on it (`Keystore.create(store, …)`). `memory` and `encryptedJson` run
 * everywhere, `@namera-ai/sdk/node` adds files and the OS keychain, `@namera-ai/sdk/browser` adds WebCrypto, and
 * `from` wraps any other backend (a database, an HSM, a KMS). `toAccount` turns a key into a viem account.
 *
 * **Gotchas**
 *
 * ox has a `Keystore` module for the encrypted JSON format, which `encryptedJson` uses; import only one of them per
 * file, or rename one.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Result from "effect/Result"

import type { Curve } from "../internal/core/key/key.ts"
import { run, type RunOptions } from "../internal/promise.ts"
import type { LocalAccount } from "../internal/viem/account.ts"
import * as internal from "./internal/keystore.ts"
import type { Key } from "./Key.ts"
import type * as KeystoreError from "./KeystoreError.ts"

/**
 * A key store. Create one with `memory`, `encryptedJson` or `from`, or with the Node and browser entries.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Keystore = internal.Store

/**
 * How `encryptedJson` derives its encryption key from the password: scrypt (the default, `n` 262144) or PBKDF2. Lower
 * the cost where key derivation is slow, such as Cloudflare Workers' free plan.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Kdf = internal.Kdf

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
 * **When to use**
 *
 * Use when testing, or for short-lived agents: keys are lost when the process ends.
 *
 * **Example** (Creating a key and signing with it)
 *
 * ```ts
 * import { Keystore } from "@namera-ai/sdk"
 *
 * const store = Keystore.memory()
 * const key = await Keystore.create(store, { curve: "secp256k1", label: "agent-1" })
 * const signature = await Keystore.sign(store, { id: key.id, digest: `0x${"11".repeat(32)}` })
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const memory: () => Keystore = internal.memory

/**
 * A store that encrypts each key with a password (Web3 Secret Storage), on every curve, in any runtime. Export it
 * with `toJson` and open the export again with `data`.
 *
 * **Gotchas**
 *
 * Throws `KeystoreError` (`Unavailable`) when `data` is not an export of this store. A wrong password shows when a
 * key is used: signing fails with `Locked`.
 *
 * **Example** (Saving and reopening a store)
 *
 * ```ts
 * import { Keystore } from "@namera-ai/sdk"
 *
 * const store = Keystore.encryptedJson({ password: "correct horse battery staple" })
 * await Keystore.create(store, { curve: "secp256k1" })
 * const data = await Keystore.toJson(store)
 *
 * const reopened = Keystore.encryptedJson({ password: "correct horse battery staple", data })
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function encryptedJson(options: encryptedJson.Options): Keystore {
  return Result.getOrThrow(internal.encryptedJson(options))
}

/**
 * Types of `Keystore.encryptedJson`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace encryptedJson {
  /**
   * The password, an export to open (`data`), and the key derivation (`kdf`).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly password: string
    readonly data?: string | undefined
    readonly kdf?: Kdf | undefined
  }
  /**
   * The errors `Keystore.encryptedJson` can throw.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = KeystoreError.KeystoreError
}

/**
 * A store on your own backend, such as a database, an HSM or a KMS. A failure that is not a `KeystoreError` becomes
 * one (`Unavailable`), with your error as cause.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const from: (backend: from.Backend) => Keystore = internal.fromPromises

/**
 * Types of `Keystore.from`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace from {
  /**
   * The backend: the curves it supports and its operations. `sign` signs a 32-byte digest as it is.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Backend {
    readonly curves: ReadonlyArray<Curve>
    readonly create: (options: { readonly curve: Curve; readonly label?: string | undefined }) => Promise<Key>
    readonly get: (id: string) => Promise<Key>
    readonly list: () => Promise<ReadonlyArray<Key>>
    readonly remove: (id: string) => Promise<void>
    readonly sign: (id: string, digest: `0x${string}`) => Promise<`0x${string}`>
  }
}

/**
 * Creates a key on a curve, and returns it.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export function create(store: Keystore, options: create.Options): Promise<Key> {
  return run(store.create(options), options)
}

/**
 * Types of `Keystore.create`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace create {
  /**
   * The curve, and a label to recognise the key by.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly curve: Curve
    readonly label?: string | undefined
  }
  /**
   * The errors `Keystore.create` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = KeystoreError.KeystoreError
}

/**
 * Returns a key by id.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export function get(store: Keystore, options: get.Options): Promise<Key> {
  return run(store.get(options.id), options)
}

/**
 * Types of `Keystore.get`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace get {
  /**
   * The key's id.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly id: string
  }
  /**
   * The errors `Keystore.get` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = KeystoreError.KeystoreError
}

/**
 * Returns every key in the store.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export function list(store: Keystore, options?: RunOptions): Promise<ReadonlyArray<Key>> {
  return run(store.list, options)
}

/**
 * Types of `Keystore.list`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace list {
  /**
   * The errors `Keystore.list` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = KeystoreError.KeystoreError
}

/**
 * Removes a key from the store.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export function remove(store: Keystore, options: remove.Options): Promise<void> {
  return run(store.remove(options.id), options)
}

/**
 * Types of `Keystore.remove`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace remove {
  /**
   * The key's id.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly id: string
  }
  /**
   * The errors `Keystore.remove` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = KeystoreError.KeystoreError
}

/**
 * Signs a 32-byte digest with a key, as it is: no hashing or prefixing. secp256k1 signatures are `r ‖ s ‖ v` (65
 * bytes), p256 `r ‖ s` (64 bytes), ed25519 64 bytes.
 *
 * **When to use**
 *
 * Use to sign a digest you computed yourself. To sign messages, typed data or transactions, use `toAccount`.
 *
 * @stability experimental
 * @category signing
 * @since 2.0.0
 */
export function sign(store: Keystore, options: sign.Options): Promise<`0x${string}`> {
  return run(store.sign(options.id, options.digest), options)
}

/**
 * Types of `Keystore.sign`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace sign {
  /**
   * The key's id and the 32-byte digest.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly id: string
    readonly digest: `0x${string}`
  }
  /**
   * The errors `Keystore.sign` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = KeystoreError.KeystoreError
}

/**
 * Returns a viem account that signs with a secp256k1 key in the store: messages, typed data, transactions and
 * EIP-7702 authorizations. Use it as a session key, a smart account owner, or any viem signer.
 *
 * **Example** (A stored key as a viem account)
 *
 * ```ts
 * import { Keystore } from "@namera-ai/sdk"
 *
 * const store = Keystore.memory()
 * const key = await Keystore.create(store, { curve: "secp256k1" })
 * const account = await Keystore.toAccount(store, { id: key.id })
 * const signature = await account.signMessage({ message: "hello" })
 * ```
 *
 * @stability experimental
 * @category conversions
 * @since 2.0.0
 */
export function toAccount(store: Keystore, options: toAccount.Options): Promise<LocalAccount> {
  return run(internal.toAccount(store, options.id), options)
}

/**
 * Types of `Keystore.toAccount`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace toAccount {
  /**
   * The key's id.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly id: string
  }
  /**
   * The errors `Keystore.toAccount` can fail with: the key is missing, or not secp256k1.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = KeystoreError.KeystoreError
}

/**
 * Exports an `encryptedJson` store: its keys, still encrypted, as JSON to save and reopen with `encryptedJson({ data
 * })`.
 *
 * @stability experimental
 * @category conversions
 * @since 2.0.0
 */
export function toJson(store: Keystore, options?: RunOptions): Promise<string> {
  return run(internal.toJson(store), options)
}

/**
 * Types of `Keystore.toJson`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace toJson {
  /**
   * The errors `Keystore.toJson` can fail with: `Unavailable` for a store that is not `encryptedJson`.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = KeystoreError.KeystoreError
}
