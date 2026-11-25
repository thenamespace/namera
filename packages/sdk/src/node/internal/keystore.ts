// Only `src/node/` uses Node's APIs; the rest of the SDK runs in any runtime, so the types are referenced here only.
/// <reference types="node" />
import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"
import * as fs from "node:fs/promises"
import * as path from "node:path"

import * as core from "../../internal/core/key/key.ts"
import {
  type Encrypted,
  isEncrypted,
  type Kdf,
  make,
  newKey,
  restore,
  sealer,
  type Store
} from "../../internal/keystore.ts"
import type { Key } from "../../keys/Key.ts"
import * as KeystoreError from "../../keys/KeystoreError.ts"

// Ids are UUIDs the stores generate. Anything else (a path, `..`) is not a key of the store.
const isId = (id: string) => /^[\w-]+$/.test(id)

const isMissing = (cause: unknown) => Predicate.hasProperty(cause, "code") && cause.code === "ENOENT"

/**
 * Keys in a folder, one encrypted JSON file per key (`<id>.json`). The folder is created `0700` and each file `0600`,
 * written to a temporary file first and renamed, so a crash never leaves a half-written key.
 *
 * @internal
 */
export const file = (options: {
  readonly path: string
  readonly password: string
  readonly kdf?: Kdf | undefined
}): Store => {
  const ref = { type: "file" } as const
  const { forget, seal, sign } = sealer({ password: options.password, kdf: options.kdf, store: ref })
  const fileOf = (id: string) => path.join(options.path, `${id}.json`)
  const failed = (detail: string) => (cause: unknown) => KeystoreError.unavailable({ store: ref, detail, cause })

  const read = (id: string): Effect.Effect<Encrypted, KeystoreError.KeystoreError> =>
    isId(id)
      ? Effect.tryPromise({
        try: async () => JSON.parse(await fs.readFile(fileOf(id), "utf8")) as unknown,
        catch: (cause) =>
          isMissing(cause)
            ? KeystoreError.notFound({ store: ref, id })
            : failed(`could not read the key file of ${id}`)(cause)
      }).pipe(Effect.flatMap((parsed) =>
        isEncrypted(parsed)
          ? Effect.succeed(restore(parsed))
          : Effect.fail(KeystoreError.unavailable({ store: ref, detail: `the key file of ${id} is not a key` }))
      ))
      : Effect.fail(KeystoreError.notFound({ store: ref, id }))

  const write = (entry: Encrypted) =>
    Effect.tryPromise({
      try: async () => {
        await fs.mkdir(options.path, { recursive: true, mode: 0o700 })
        const temporary = `${fileOf(entry.key.id)}.${process.pid}.tmp`
        await fs.writeFile(temporary, JSON.stringify(entry), { mode: 0o600 })
        await fs.rename(temporary, fileOf(entry.key.id))
      },
      catch: failed("could not write the key file")
    })

  return make({
    type: "file",
    curves: core.curves,
    create: (request) => Effect.flatMap(seal(request), (sealed) => Effect.as(write(sealed), sealed.key)),
    get: (id) => Effect.map(read(id), ({ key }) => key),
    list: Effect.tryPromise({
      try: async () => {
        const names = await fs.readdir(options.path).catch((cause: unknown) => {
          if (isMissing(cause)) return []
          throw cause
        })
        return names.filter((name: string) => name.endsWith(".json")).map((name: string) =>
          name.slice(0, -".json".length)
        )
      },
      catch: failed("could not list the key folder")
    }).pipe(
      Effect.flatMap((ids) => Effect.forEach(ids, (id) => Effect.map(read(id), ({ key }) => key)))
    ),
    remove: (id) =>
      isId(id)
        ? Effect.tryPromise({
          try: () => fs.unlink(fileOf(id)),
          catch: (cause) =>
            isMissing(cause)
              ? KeystoreError.notFound({ store: ref, id })
              : failed("could not remove the key file")(cause)
        }).pipe(Effect.map(() => forget(id)))
        : Effect.fail(KeystoreError.notFound({ store: ref, id })),
    sign: (id, digest) => Effect.flatMap(read(id), (entry) => sign(entry, digest))
  })
}

interface Keyring {
  readonly AsyncEntry: new(service: string, username: string) => {
    readonly setPassword: (password: string) => Promise<void>
    readonly getPassword: () => Promise<string | null>
    readonly deletePassword: () => Promise<boolean>
  }
  readonly findCredentialsAsync: (
    service: string
  ) => Promise<ReadonlyArray<{ readonly account: string; readonly password: string }>>
}

interface Secret {
  readonly version: 1
  readonly key: Key
  readonly privateKey: `0x${string}`
}

const isSecret = (u: unknown): u is Secret =>
  Predicate.hasProperty(u, "version") && u.version === 1 && Predicate.hasProperty(u, "key")
  && Predicate.hasProperty(u, "privateKey") && Predicate.isString(u.privateKey)

/**
 * Keys in the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) through the optional
 * `@napi-rs/keyring`: one secret per key, the account being the key's id, under `service`. The keychain encrypts
 * them; nothing is written to disk by Namera.
 *
 * @internal
 */
export const osKeychain = (options: { readonly service: string }): Store => {
  const ref = { type: "osKeychain" } as const
  const failed = (detail: string) => (cause: unknown) => KeystoreError.unavailable({ store: ref, detail, cause })

  // Loaded on first use, so the store can be created where the package is missing and fails clearly when used.
  let keyring: Promise<Keyring> | undefined
  const load = Effect.tryPromise({
    try: () => (keyring ??= import("@napi-rs/keyring") as Promise<unknown> as Promise<Keyring>),
    catch: failed("install @napi-rs/keyring to use the OS keychain")
  })
  const entry = (id: string) => Effect.map(load, ({ AsyncEntry }) => new AsyncEntry(options.service, id))

  const parse = (id: string, password: string) => {
    try {
      const parsed: unknown = JSON.parse(password)
      if (isSecret(parsed)) {
        return Effect.succeed({ ...parsed, key: { ...parsed.key, label: parsed.key.label ?? undefined } })
      }
    } catch {
      // reported below
    }
    return Effect.fail(KeystoreError.unavailable({ store: ref, detail: `the keychain secret of ${id} is not a key` }))
  }

  const read = (id: string) =>
    Effect.flatMap(
      entry(id),
      (secret) =>
        Effect.tryPromise({ try: () => secret.getPassword(), catch: failed("the OS keychain refused to read") }).pipe(
          Effect.flatMap((password) =>
            password === null ? Effect.fail(KeystoreError.notFound({ store: ref, id })) : parse(id, password)
          )
        )
    )

  return make({
    type: "osKeychain",
    curves: core.curves,
    create: Effect.fnUntraced(function*(request) {
      const privateKey = core.generate(request.curve)
      const key = yield* newKey({ ...request, publicKey: core.publicKey(request.curve, privateKey) })
      const secret = yield* entry(key.id)
      yield* Effect.tryPromise({
        try: () => secret.setPassword(JSON.stringify({ version: 1, key, privateKey } satisfies Secret)),
        catch: failed("the OS keychain refused to store the key")
      })
      return key
    }),
    get: (id) => Effect.map(read(id), ({ key }) => key),
    list: Effect.flatMap(load, (keyring) =>
      Effect.tryPromise({
        try: () => keyring.findCredentialsAsync(options.service),
        catch: failed("the OS keychain refused to list")
      })).pipe(
        Effect.flatMap((credentials) =>
          Effect.forEach(credentials, ({ account, password }) => Effect.map(parse(account, password), ({ key }) => key))
        )
      ),
    // Reading first gives a clean NotFound: some keychains throw, rather than answer false, for a missing entry.
    remove: (id) =>
      Effect.flatMap(read(id), () => entry(id)).pipe(
        Effect.flatMap((secret) =>
          Effect.tryPromise({ try: () => secret.deletePassword(), catch: failed("the OS keychain refused to remove") })
        ),
        Effect.asVoid
      ),
    sign: (id, digest) => Effect.map(read(id), ({ key, privateKey }) => core.sign(key.curve, privateKey, digest))
  })
}
