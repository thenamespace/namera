import type { Key, Keystore, KeystoreError, SessionKey, SessionKeyError } from "@namera-ai/sdk"
import type { Keystore as EffectKeystore, SessionKey as EffectSessionKey } from "@namera-ai/sdk/effect"
import type { Effect } from "effect"
import { describe, expect, it } from "tstyche"
import type { LocalAccount } from "viem"

describe("Keystore", () => {
  it("turns a key into viem's local account, in both APIs", () => {
    expect<ReturnType<typeof Keystore.toAccount>>().type.toBe<Promise<LocalAccount>>()
    expect<ReturnType<typeof EffectKeystore.toAccount>>().type.toBe<
      Effect.Effect<LocalAccount, KeystoreError.KeystoreError>
    >()
  })

  it("returns keys, and fails with KeystoreError only", () => {
    expect<ReturnType<typeof Keystore.create>>().type.toBe<Promise<Key.Key>>()
    expect<Keystore.create.ErrorType>().type.toBe<KeystoreError.KeystoreError>()
    expect<ReturnType<typeof EffectKeystore.sign>>().type.toBe<
      Effect.Effect<`0x${string}`, KeystoreError.KeystoreError>
    >()
  })

  it("names its curves", () => {
    expect<Key.Curve>().type.toBe<"secp256k1" | "ed25519" | "p256">()
    expect<Keystore.Keystore["prehash"]>().type.toBe<"sha256" | undefined>()
  })
})

describe("SessionKey", () => {
  it("returns the session key in the Promise API and an Effect failing with SessionKeyError in the Effect API", () => {
    expect<ReturnType<typeof SessionKey.ecdsa>>().type.toBe<SessionKey.SessionKey>()
    expect<ReturnType<typeof EffectSessionKey.ecdsa>>().type.toBe<
      Effect.Effect<SessionKey.SessionKey, SessionKeyError.SessionKeyError>
    >()
  })

  it("describes ECDSA signers", () => {
    expect<SessionKey.SessionKey["type"]>().type.toBe<"ecdsa">()
    expect<SessionKey.SessionKey["signers"]>().type.toBe<ReadonlyArray<`0x${string}`>>()
  })
})
