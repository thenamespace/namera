/**
 * Namera's Effect API: the same modules and names as `@namera-ai/sdk`, with every asynchronous function returning an `Effect` that fails with the same error instances.
 *
 * **Details**
 *
 * - Functions take the same options as their Promise forms, without `signal`: interrupting the fiber cancels them.
 * - Every effect has `never` as its requirements. Pure functions (`Policy.*`, `Session.describe`) are the same values
 *   in both APIs, and so are the error classes, so `instanceof`, `Effect.catchTag` and `Effect.catchReason` work on
 *   either side.
 * - Services exist only here: `Keystore.CurrentKeystore`, with `Keystore.layer`, `layerMemory`, `layerEncryptedJson`
 *   and the node and browser entries' layers. A service in context wins over an option that names the same thing.
 *
 * @stability experimental
 * @since 2.0.0
 */

// @barrel({*,accounts/*,keys/*,infra/*}.ts): Auto-generated exports. Do not edit manually.

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as ChainError from "./ChainError.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as Grant from "./Grant.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as GrantError from "./GrantError.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as NameraError from "./NameraError.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as Policy from "./Policy.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as PolicyViolationError from "./PolicyViolationError.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as Session from "./Session.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as SessionError from "./SessionError.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as AccountError from "./accounts/AccountError.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as KernelAccount from "./accounts/KernelAccount.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as SmartAccount from "./accounts/SmartAccount.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as Bundler from "./infra/Bundler.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as BundlerError from "./infra/BundlerError.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as Compat from "./infra/Compat.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as CompatError from "./infra/CompatError.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as Paymaster from "./infra/Paymaster.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as PaymasterError from "./infra/PaymasterError.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as Key from "./keys/Key.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as Keystore from "./keys/Keystore.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as KeystoreError from "./keys/KeystoreError.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as SessionKey from "./keys/SessionKey.ts"

/**
 * @stability experimental
 * @since 2.0.0
 */
export * as SessionKeyError from "./keys/SessionKeyError.ts"
