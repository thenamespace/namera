/**
 * Key stores for browsers: P-256 keys the browser holds, through WebCrypto and IndexedDB.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type { Store } from "../internal/keystore.ts"
import * as internal from "./internal/keystore.ts"

/**
 * A store of non-extractable P-256 WebCrypto keys in IndexedDB: the browser holds them, and no script on the page,
 * Namera included, can read a private key.
 *
 * **When to use**
 *
 * Use to keep P-256 session keys in a browser. They sign through a P-256 session validator, which Namera adds after
 * launch; secp256k1 keys (EVM accounts) need another store, such as `Keystore.encryptedJson`.
 *
 * **Gotchas**
 *
 * - p256 only: browsers have no secp256k1, so creating one fails with `KeystoreError` (`CurveUnsupported`).
 * - WebCrypto hashes what it signs with SHA-256, so the store's `prehash` is `"sha256"`: `Keystore.sign` returns a
 *   signature of the SHA-256 of the digest.
 *
 * **Example** (A P-256 key in the browser)
 *
 * ```ts
 * import { Keystore } from "@namera-ai/sdk"
 * import { Keystore as BrowserKeystore } from "@namera-ai/sdk/browser"
 *
 * const store = BrowserKeystore.webCrypto()
 * const key = await Keystore.create(store, { curve: "p256", label: "session" })
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const webCrypto: (options?: webCrypto.Options) => Store = internal.webCrypto

/**
 * Types of `Keystore.webCrypto`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace webCrypto {
  /**
   * The IndexedDB database the keys are kept in (`"namera-keys"` by default).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly database?: string | undefined
  }
}
