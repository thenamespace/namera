import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"
import * as Result from "effect/Result"
import * as OxKeystore from "ox/Keystore"

import * as core from "../../internal/core/key/key.ts"
import { run } from "../../internal/promise.ts"
import { type LocalAccount, localAccount } from "../../internal/viem/account.ts"
import { isNameraError } from "../../NameraError.ts"
import * as KeystoreError from "../KeystoreError.ts"
import type { Key } from "./key.ts"

const TypeId = "~@namera-ai/sdk/keys/Keystore" as const

/** Which kind of store holds the keys. */
export type StoreType = typeof KeystoreError.StoreRef.Type["type"]

/**
 * A key store: where keys live and sign. Private keys never leave it.
 */
export interface Store {
  readonly [TypeId]: typeof TypeId
  readonly type: StoreType
  readonly curves: ReadonlyArray<core.Curve>
  readonly create: (options: {
    readonly curve: core.Curve
    readonly label?: string | undefined
  }) => Effect.Effect<Key, KeystoreError.KeystoreError>
  readonly get: (id: string) => Effect.Effect<Key, KeystoreError.KeystoreError>
  readonly list: Effect.Effect<ReadonlyArray<Key>, KeystoreError.KeystoreError>
  readonly remove: (id: string) => Effect.Effect<void, KeystoreError.KeystoreError>
  readonly sign: (id: string, digest: `0x${string}`) => Effect.Effect<`0x${string}`, KeystoreError.KeystoreError>
  readonly toJson?: Effect.Effect<string, KeystoreError.KeystoreError> | undefined
}

/** @internal */
export const isStore = (u: unknown): u is Store => Predicate.hasProperty(u, TypeId)

const isDigest = (digest: string) => /^0x[0-9a-fA-F]{64}$/.test(digest)

/**
 * Checks a request against the store before it reaches the backend: the curve is supported and the digest is 32 bytes.
 *
 * @internal
 */
export const make = (store: Omit<Store, typeof TypeId>): Store => ({
  ...store,
  [TypeId]: TypeId,
  create: (options) =>
    store.curves.includes(options.curve)
      ? store.create(options)
      : Effect.fail(
        KeystoreError.curveUnsupported({ store: { type: store.type }, curve: options.curve, supported: store.curves })
      ),
  sign: (id, digest) =>
    isDigest(digest)
      ? store.sign(id, digest)
      : Effect.fail(KeystoreError.invalidDigest({ store: { type: store.type }, digest }))
})

const newKey = (
  options: { readonly curve: core.Curve; readonly label?: string | undefined; readonly publicKey: `0x${string}` }
) =>
  Effect.map(Clock.currentTimeMillis, (millis): Key => ({
    id: globalThis.crypto.randomUUID(),
    label: options.label,
    curve: options.curve,
    publicKey: options.publicKey,
    createdAt: Math.floor(millis / 1000)
  }))

/**
 * Keys in memory for the process's lifetime, on every curve.
 *
 * @internal
 */
export const memory = (): Store => {
  const keys = new Map<string, { readonly key: Key; readonly privateKey: `0x${string}` }>()
  const ref = { type: "memory" } as const
  const entry = (id: string) =>
    Effect.suspend(() => {
      const found = keys.get(id)
      return found === undefined ? Effect.fail(KeystoreError.notFound({ store: ref, id })) : Effect.succeed(found)
    })

  return make({
    type: "memory",
    curves: core.curves,
    create: Effect.fnUntraced(function*({ curve, label }) {
      const privateKey = core.generate(curve)
      const key = yield* newKey({ curve, label, publicKey: core.publicKey(curve, privateKey) })
      keys.set(key.id, { key, privateKey })
      return key
    }),
    get: (id) => Effect.map(entry(id), ({ key }) => key),
    list: Effect.sync(() => Array.from(keys.values(), ({ key }) => key)),
    remove: (id) => Effect.map(entry(id), () => void keys.delete(id)),
    sign: (id, digest) => Effect.map(entry(id), ({ key, privateKey }) => core.sign(key.curve, privateKey, digest))
  })
}

/**
 * How `encryptedJson` derives the encryption key from the password: scrypt (default `n` 262144, `r` 1, `p` 8) or
 * PBKDF2 (default 262144 iterations). Lower the cost where key derivation is slow, such as Cloudflare Workers.
 */
export type Kdf =
  | {
    readonly type: "scrypt"
    readonly n?: number | undefined
    readonly r?: number | undefined
    readonly p?: number | undefined
  }
  | { readonly type: "pbkdf2"; readonly iterations?: number | undefined }

interface Encrypted {
  readonly key: Key
  readonly keystore: OxKeystore.Keystore
}

const exportVersion = 1

const isEncrypted = (u: unknown): u is Encrypted =>
  Predicate.hasProperty(u, "key") && Predicate.hasProperty(u, "keystore")
  && Predicate.hasProperty(u.keystore, "crypto") && Predicate.hasProperty(u.keystore, "version")

const parseExport = (data: string): ReadonlyArray<Encrypted> | undefined => {
  try {
    const parsed: unknown = JSON.parse(data)
    if (!Predicate.hasProperty(parsed, "version") || parsed.version !== exportVersion) return undefined
    if (!Predicate.hasProperty(parsed, "keys") || !Array.isArray(parsed.keys)) return undefined
    if (!parsed.keys.every(isEncrypted)) return undefined
    // JSON drops a key's `label` when it is undefined; restore it so loaded keys equal the ones created.
    return parsed.keys.map(({ key, keystore }) => ({ key: { ...key, label: key.label ?? undefined }, keystore }))
  } catch {
    return undefined
  }
}

/**
 * Keys encrypted with a password (Web3 Secret Storage, through ox), on every curve. `data` loads a `toJson` export.
 *
 * @internal
 */
export const encryptedJson = (options: {
  readonly password: string
  readonly data?: string | undefined
  readonly kdf?: Kdf | undefined
}): Result.Result<Store, KeystoreError.KeystoreError> => {
  const ref = { type: "encryptedJson" } as const
  const loaded = options.data === undefined ? [] : parseExport(options.data)
  if (loaded === undefined) {
    return Result.fail(
      KeystoreError.unavailable({ store: ref, detail: "the data is not an encryptedJson export" })
    )
  }

  const keys = new Map(loaded.map((entry) => [entry.key.id, entry]))
  // Deriving the key from the password is the slow part, so each key's derived key is kept once unlocked.
  const derived = new Map<string, OxKeystore.Key>()
  const kdf = options.kdf ?? { type: "scrypt" }

  const derive = () =>
    Effect.promise((): Promise<readonly [OxKeystore.Key, OxKeystore.DeriveOpts]> =>
      kdf.type === "scrypt"
        ? OxKeystore.scryptAsync({ password: options.password, n: kdf.n, r: kdf.r, p: kdf.p })
        : OxKeystore.pbkdf2Async({ password: options.password, iterations: kdf.iterations })
    )

  const entry = (id: string) =>
    Effect.suspend(() => {
      const found = keys.get(id)
      return found === undefined ? Effect.fail(KeystoreError.notFound({ store: ref, id })) : Effect.succeed(found)
    })

  const privateKey = Effect.fnUntraced(function*(id: string) {
    const { keystore } = yield* entry(id)
    const key = derived.get(id) ??
      (yield* Effect.promise(() => OxKeystore.toKeyAsync(keystore, { password: options.password })))
    const decrypted = yield* Effect.try({
      try: () => OxKeystore.decrypt(keystore, key),
      catch: (cause) => KeystoreError.locked({ store: ref, cause })
    })
    derived.set(id, key)
    return decrypted
  })

  return Result.succeed(make({
    type: "encryptedJson",
    curves: core.curves,
    create: Effect.fnUntraced(function*({ curve, label }) {
      const secret = core.generate(curve)
      const key = yield* newKey({ curve, label, publicKey: core.publicKey(curve, secret) })
      const [derivedKey, opts] = yield* derive()
      keys.set(key.id, { key, keystore: OxKeystore.encrypt(secret, derivedKey, { ...opts, id: key.id }) })
      derived.set(key.id, derivedKey)
      return key
    }),
    get: (id) => Effect.map(entry(id), ({ key }) => key),
    list: Effect.sync(() => Array.from(keys.values(), ({ key }) => key)),
    remove: (id) =>
      Effect.map(entry(id), () => {
        keys.delete(id)
        derived.delete(id)
      }),
    sign: Effect.fnUntraced(function*(id, digest) {
      const { key } = yield* entry(id)
      return core.sign(key.curve, yield* privateKey(id), digest)
    }),
    toJson: Effect.sync(() => JSON.stringify({ version: exportVersion, keys: Array.from(keys.values()) }))
  }))
}

const custom = { type: "custom" } as const

const translate = (cause: unknown) =>
  KeystoreError.isKeystoreError(cause) || isNameraError(cause)
    ? (cause as KeystoreError.KeystoreError)
    : KeystoreError.unavailable({ store: custom, detail: "the custom store failed", cause })

/**
 * A store whose methods return Promises.
 *
 * @internal
 */
export const fromPromises = (backend: {
  readonly curves: ReadonlyArray<core.Curve>
  readonly create: (options: { readonly curve: core.Curve; readonly label?: string | undefined }) => Promise<Key>
  readonly get: (id: string) => Promise<Key>
  readonly list: () => Promise<ReadonlyArray<Key>>
  readonly remove: (id: string) => Promise<void>
  readonly sign: (id: string, digest: `0x${string}`) => Promise<`0x${string}`>
}): Store => {
  const lift = <A>(f: () => Promise<A>) => Effect.tryPromise({ try: f, catch: translate })
  return make({
    type: "custom",
    curves: backend.curves,
    create: (options) => lift(() => backend.create(options)),
    get: (id) => lift(() => backend.get(id)),
    list: lift(() => backend.list()),
    remove: (id) => lift(() => backend.remove(id)),
    sign: (id, digest) => lift(() => backend.sign(id, digest))
  })
}

/**
 * A store whose methods return Effects.
 *
 * @internal
 */
export const fromEffects = (backend: {
  readonly curves: ReadonlyArray<core.Curve>
  readonly create: (options: {
    readonly curve: core.Curve
    readonly label?: string | undefined
  }) => Effect.Effect<Key, KeystoreError.KeystoreError>
  readonly get: (id: string) => Effect.Effect<Key, KeystoreError.KeystoreError>
  readonly list: Effect.Effect<ReadonlyArray<Key>, KeystoreError.KeystoreError>
  readonly remove: (id: string) => Effect.Effect<void, KeystoreError.KeystoreError>
  readonly sign: (id: string, digest: `0x${string}`) => Effect.Effect<`0x${string}`, KeystoreError.KeystoreError>
}): Store => make({ type: "custom", ...backend })

/**
 * The encrypted export of an `encryptedJson` store.
 *
 * @internal
 */
export const toJson = (store: Store): Effect.Effect<string, KeystoreError.KeystoreError> =>
  store.toJson ?? Effect.fail(
    KeystoreError.unavailable({ store: { type: store.type }, detail: "only an encryptedJson store exports JSON" })
  )

/**
 * A viem local account that signs with a secp256k1 key in the store.
 *
 * @internal
 */
export const toAccount = (store: Store, id: string): Effect.Effect<LocalAccount, KeystoreError.KeystoreError> =>
  Effect.gen(function*() {
    const key = yield* store.get(id)
    if (key.curve !== "secp256k1") {
      return yield* KeystoreError.curveUnsupported({
        store: { type: store.type },
        curve: key.curve,
        supported: ["secp256k1"],
        detail: "viem accounts sign with secp256k1 keys"
      })
    }
    return localAccount({
      address: core.evmAddress(key.publicKey),
      publicKey: key.publicKey,
      sign: (hash) => run(store.sign(id, hash))
    })
  })
