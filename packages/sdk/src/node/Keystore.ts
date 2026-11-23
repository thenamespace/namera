/**
 * Key stores for Node (and Bun and Deno for files): an encrypted file per key, and the OS keychain.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type { Kdf, Store } from "../internal/keystore.ts"
import * as internal from "./internal/keystore.ts"

/**
 * A store that keeps each key in an encrypted JSON file (Web3 Secret Storage) in a folder, on every curve. The folder
 * is created `0700` and each file `0600`.
 *
 * **When to use**
 *
 * Use with servers and agents that keep keys on disk across restarts.
 *
 * **Example** (Keys in a folder)
 *
 * ```ts
 * import { Keystore } from "@namera-ai/sdk"
 * import { Keystore as NodeKeystore } from "@namera-ai/sdk/node"
 *
 * const store = NodeKeystore.file({ path: "./keys", password: process.env.KEYS_PASSWORD! })
 * const key = await Keystore.create(store, { curve: "secp256k1", label: "agent-1" })
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const file: (options: file.Options) => Store = internal.file

/**
 * Types of `Keystore.file`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace file {
  /**
   * The folder, the password, and the key derivation (`kdf`, scrypt by default).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly path: string
    readonly password: string
    readonly kdf?: Kdf | undefined
  }
}

/**
 * A store that keeps keys in the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service), on
 * every curve, through the optional `@napi-rs/keyring` package.
 *
 * **Gotchas**
 *
 * Install `@napi-rs/keyring` to use it. Without it, or without a keychain service (a Linux server without Secret
 * Service), every operation fails with `KeystoreError` (`Unavailable`).
 *
 * **Example** (Keys in the OS keychain)
 *
 * ```ts
 * import { Keystore } from "@namera-ai/sdk"
 * import { Keystore as NodeKeystore } from "@namera-ai/sdk/node"
 *
 * const store = NodeKeystore.osKeychain({ service: "my-agent" })
 * const key = await Keystore.create(store, { curve: "secp256k1" })
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const osKeychain: (options: osKeychain.Options) => Store = internal.osKeychain

/**
 * Types of `Keystore.osKeychain`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace osKeychain {
  /**
   * The keychain service the keys are stored under, such as your app's name.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly service: string
  }
}
