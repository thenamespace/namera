/**
 * Failures storing, reading or signing with keys, and using a key where its curve or chain is not supported.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Data from "effect/Data"
import * as Predicate from "effect/Predicate"

import { TypeId as NameraErrorTypeId } from "../internal/nameraError.ts"
import { version } from "../internal/version.ts"
import type * as NameraError from "../NameraError.ts"

const TypeId = "~@namera-ai/sdk/keys/KeystoreError" as const

const withDetail = (summary: string, detail: string | undefined) =>
  detail === undefined ? summary : `${summary}: ${detail}`

/**
 * No key with this id is in the store.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class NotFound extends Data.TaggedError("NotFound")<{
  readonly id: string
  readonly detail?: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return withDetail(`No key ${this.id} in the store`, this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "List the store's keys with `Keystore.list`."
  }
}

/**
 * The store could not decrypt the key: the password is wrong, or the stored data is damaged.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Locked extends Data.TaggedError("Locked")<{ readonly detail?: string; readonly cause?: unknown }> {
  override get message(): string {
    return withDetail("The store could not decrypt the key", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Check the password the store was opened with."
  }
}

/**
 * The store or the operation does not support the key's curve.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class CurveUnsupported extends Data.TaggedError("CurveUnsupported")<{
  readonly curve: "secp256k1" | "ed25519" | "p256"
  readonly supported?: ReadonlyArray<"secp256k1" | "ed25519" | "p256">
  readonly detail?: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return withDetail(`The ${this.curve} curve is not supported here`, this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return this.supported === undefined
      ? "Use a secp256k1 key."
      : `Use one of: ${this.supported.join(", ")}.`
  }
}

/**
 * Addresses of this chain namespace are not supported yet.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class NamespaceUnsupported extends Data.TaggedError("NamespaceUnsupported")<{
  readonly namespace: string
  readonly detail?: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return withDetail(`Addresses on the ${this.namespace} namespace are not supported`, this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Supported: eip155 (EVM chains)."
  }
}

/**
 * The store's backend can't be used here: a missing optional package, no OS keychain service, no IndexedDB, or a
 * store that does not support the operation.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Unavailable
  extends Data.TaggedError("Unavailable")<{ readonly detail?: string; readonly cause?: unknown }>
{
  override get message(): string {
    return withDetail("The key store is not available", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Use a store this runtime supports, such as `Keystore.encryptedJson`."
  }
}

/**
 * A digest to sign that is not 32 bytes of hex.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class InvalidDigest extends Data.TaggedError("InvalidDigest")<{
  readonly digest: string
  readonly detail?: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return withDetail("The digest to sign is not 32 bytes", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Pass a 32-byte hash, such as the keccak256 of the message."
  }
}

/**
 * The specific failure behind a `KeystoreError`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type KeystoreErrorReason =
  | NotFound
  | Locked
  | CurveUnsupported
  | NamespaceUnsupported
  | InvalidDigest
  | Unavailable

/**
 * The store a `KeystoreError` is about.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface StoreRef {
  readonly type: "memory" | "encryptedJson" | "file" | "osKeychain" | "webCrypto" | "custom"
}

/**
 * A failure storing, reading or signing with a key. `store` says which store, when one was involved; `reason` what
 * failed. Messages never include passwords or keys.
 *
 * **Example** (Narrowing on the reason)
 *
 * ```ts import.meta.vitest
 * import { KeystoreError } from "@namera-ai/sdk"
 *
 * const error = KeystoreError.notFound({ store: { type: "memory" }, id: "agent-1" })
 *
 * error.reason._tag // => "NotFound"
 * error.shortMessage // => "No key agent-1 in the store"
 * error.metaMessages // => ["Store: memory", "Hint: List the store's keys with `Keystore.list`."]
 * ```
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class KeystoreError extends Data.TaggedError("KeystoreError")<{
  readonly store?: StoreRef
  readonly reason: KeystoreErrorReason
}> implements NameraError.Fields {
  readonly [TypeId] = TypeId
  readonly [NameraErrorTypeId] = NameraErrorTypeId

  override readonly cause = this.reason

  get shortMessage(): string {
    return this.reason.message
  }

  get details(): string | undefined {
    const { cause } = this.reason
    return Predicate.isError(cause) ? cause.message : undefined
  }

  get docsPath(): string | undefined {
    return undefined
  }

  get metaMessages(): ReadonlyArray<string> {
    return [
      ...(this.store === undefined ? [] : [`Store: ${this.store.type}`]),
      `Hint: ${this.reason.hint}`
    ]
  }

  get version(): string {
    return `@namera-ai/sdk@${version}`
  }

  override get message(): string {
    return this.shortMessage
  }
}

/**
 * Checks whether a value is a `KeystoreError`, from any copy of the package.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isKeystoreError = (u: unknown): u is KeystoreError => Predicate.hasProperty(u, TypeId)

/**
 * The options every `KeystoreError` constructor accepts: the store, a detail for the message, and the underlying
 * failure.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Options {
  readonly store?: StoreRef | undefined
  readonly detail?: string | undefined
  readonly cause?: unknown
}

const make = (reason: KeystoreErrorReason, { store }: Options) =>
  new KeystoreError(store === undefined ? { reason } : { store, reason })

const reasonFields = ({ cause, detail }: Options) => ({
  ...(detail === undefined ? {} : { detail }),
  ...(cause === undefined ? {} : { cause })
})

/**
 * Creates a `KeystoreError` for a key id the store does not have.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const notFound = (options: Options & { readonly id: string }): KeystoreError =>
  make(new NotFound({ ...reasonFields(options), id: options.id }), options)

/**
 * Creates a `KeystoreError` for a key the store could not decrypt.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const locked = (options: Options = {}): KeystoreError => make(new Locked(reasonFields(options)), options)

/**
 * Creates a `KeystoreError` for a curve the store or operation does not support. `supported` lists those it does.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const curveUnsupported = (
  options: Options & {
    readonly curve: "secp256k1" | "ed25519" | "p256"
    readonly supported?: ReadonlyArray<"secp256k1" | "ed25519" | "p256"> | undefined
  }
): KeystoreError =>
  make(
    new CurveUnsupported({
      ...reasonFields(options),
      curve: options.curve,
      ...(options.supported === undefined ? {} : { supported: options.supported })
    }),
    options
  )

/**
 * Creates a `KeystoreError` for a chain namespace whose addresses are not supported yet.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const namespaceUnsupported = (options: Options & { readonly namespace: string }): KeystoreError =>
  make(new NamespaceUnsupported({ ...reasonFields(options), namespace: options.namespace }), options)

/**
 * Creates a `KeystoreError` for a digest that is not 32 bytes.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const invalidDigest = (options: Options & { readonly digest: string }): KeystoreError =>
  make(new InvalidDigest({ ...reasonFields(options), digest: options.digest }), options)

/**
 * Creates a `KeystoreError` for a store that can't be used here.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const unavailable = (options: Options = {}): KeystoreError =>
  make(new Unavailable(reasonFields(options)), options)
