import * as Effect from "effect/Effect"
import * as Bytes from "ox/Bytes"
import * as Hex from "ox/Hex"

import { make, newKey, type Store } from "../../internal/keystore.ts"
import type { Key } from "../../keys/Key.ts"
import * as KeystoreError from "../../keys/KeystoreError.ts"

const objectStore = "keys"

// The P-256 group order; WebCrypto returns either `s`, and verifiers that follow RIP-7212 accept both, but Namera's
// signatures always have a low `s`.
const order = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551")

interface Stored {
  readonly id: string
  readonly key: Key
  readonly privateKey: CryptoKey
}

const request = <A>(open: () => IDBRequest<A>) =>
  new Promise<A>((resolve, reject) => {
    const pending = open()
    pending.onsuccess = () => resolve(pending.result)
    pending.onerror = () => reject(pending.error)
  })

/**
 * P-256 keys as non-extractable WebCrypto keys in IndexedDB: the browser holds them, and neither Namera nor a script on
 * the page can read the private key. WebCrypto hashes what it signs with SHA-256, so the store's `prehash` is
 * `"sha256"`.
 *
 * @internal
 */
export const webCrypto = (options: { readonly database?: string | undefined } = {}): Store => {
  const ref = { type: "webCrypto" } as const
  const failed = (detail: string) => (cause: unknown) => KeystoreError.unavailable({ store: ref, detail, cause })

  let database: Promise<IDBDatabase> | undefined
  const open = Effect.tryPromise({
    try: () =>
      database ??= new Promise<IDBDatabase>((resolve, reject) => {
        if (globalThis.indexedDB === undefined) return reject(new Error("IndexedDB is not available"))
        const opening = globalThis.indexedDB.open(options.database ?? "namera-keys", 1)
        opening.onupgradeneeded = () => opening.result.createObjectStore(objectStore, { keyPath: "id" })
        opening.onsuccess = () => resolve(opening.result)
        opening.onerror = () => reject(opening.error)
      }),
    catch: failed("the browser has no IndexedDB")
  })
  const transaction = <A>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<A>, detail: string) =>
    Effect.flatMap(open, (db) =>
      Effect.tryPromise({
        try: () => request(() => run(db.transaction(objectStore, mode).objectStore(objectStore))),
        catch: failed(detail)
      }))

  const read = (id: string) =>
    Effect.flatMap(
      transaction("readonly", (store) => store.get(id) as IDBRequest<Stored | undefined>, "could not read the key"),
      (stored) =>
        stored === undefined ? Effect.fail(KeystoreError.notFound({ store: ref, id })) : Effect.succeed(stored)
    )

  return make({
    type: "webCrypto",
    curves: ["p256"],
    prehash: "sha256",
    create: Effect.fnUntraced(function*(options) {
      const pair = yield* Effect.tryPromise({
        try: () =>
          globalThis.crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]),
        catch: failed("the browser could not create a P-256 key")
      })
      const publicKey = yield* Effect.tryPromise({
        try: () => globalThis.crypto.subtle.exportKey("raw", pair.publicKey),
        catch: failed("the browser could not export the public key")
      })
      const key = yield* newKey({ ...options, publicKey: Hex.fromBytes(new Uint8Array(publicKey)) })
      yield* transaction(
        "readwrite",
        (store) => store.add({ id: key.id, key, privateKey: pair.privateKey }),
        "could not store the key"
      )
      return key
    }),
    get: (id) => Effect.map(read(id), ({ key }) => key),
    list: Effect.map(
      transaction("readonly", (store) => store.getAll() as IDBRequest<Array<Stored>>, "could not list the keys"),
      (stored) => stored.map(({ key }) => key)
    ),
    remove: (id) =>
      Effect.flatMap(read(id), () => transaction("readwrite", (store) => store.delete(id), "could not remove the key")),
    sign: (id, digest) =>
      Effect.flatMap(read(id), ({ privateKey }) =>
        Effect.tryPromise({
          try: () =>
            globalThis.crypto.subtle.sign(
              { name: "ECDSA", hash: "SHA-256" },
              privateKey,
              Bytes.fromHex(digest) as Uint8Array<ArrayBuffer>
            ),
          catch: failed("the browser could not sign")
        })).pipe(Effect.map((signature) => {
          const bytes = new Uint8Array(signature)
          const r = Hex.fromBytes(bytes.slice(0, 32))
          const s = BigInt(Hex.fromBytes(bytes.slice(32)))
          return Hex.concat(r, Hex.fromNumber(s > order / BigInt(2) ? order - s : s, { size: 32 }))
        }))
  })
}
