/**
 * The Effect form of `@namera-ai/sdk/node`'s `Keystore`: the same stores, used with the Effect API's `Keystore`
 * functions, and layers that provide them as `Keystore.CurrentKeystore`.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Layer from "effect/Layer"

import * as Keystore from "../../node/Keystore.ts"
import { CurrentKeystore } from "../keys/Keystore.ts"

export * from "../../node/Keystore.ts"

/**
 * Layer that provides a `file` store as `Keystore.CurrentKeystore`.
 *
 * @stability experimental
 * @category layers
 * @since 2.0.0
 */
export const layerFile = (options: Keystore.file.Options): Layer.Layer<CurrentKeystore> =>
  Layer.sync(CurrentKeystore, () => Keystore.file(options))

/**
 * Layer that provides an `osKeychain` store as `Keystore.CurrentKeystore`.
 *
 * @stability experimental
 * @category layers
 * @since 2.0.0
 */
export const layerOsKeychain = (options: Keystore.osKeychain.Options): Layer.Layer<CurrentKeystore> =>
  Layer.sync(CurrentKeystore, () => Keystore.osKeychain(options))
