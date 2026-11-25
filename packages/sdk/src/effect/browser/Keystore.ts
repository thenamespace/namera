/**
 * The Effect form of `@namera-ai/sdk/browser`'s `Keystore`: the same store, used with the Effect API's `Keystore`
 * functions, and a layer that provides it as `Keystore.CurrentKeystore`.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Layer from "effect/Layer"

import * as Keystore from "../../browser/Keystore.ts"
import { CurrentKeystore } from "../keys/Keystore.ts"

export * from "../../browser/Keystore.ts"

/**
 * Layer that provides a `webCrypto` store as `Keystore.CurrentKeystore`.
 *
 * @stability experimental
 * @category layers
 * @since 2.0.0
 */
export const layerWebCrypto = (options?: Keystore.webCrypto.Options): Layer.Layer<CurrentKeystore> =>
  Layer.sync(CurrentKeystore, () => Keystore.webCrypto(options))
