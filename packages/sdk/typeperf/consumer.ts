// A consumer of the SDK's public entries, compiled by `pnpm type-cost` to measure what the SDK costs the type checker.
import {
  ChainError,
  KernelAccount,
  Key,
  Keystore,
  NameraError,
  Session,
  SessionKey,
  SmartAccount
} from "@namera-ai/sdk"
import { Keystore as EffectKeystore, Session as EffectSession } from "@namera-ai/sdk/effect"
import * as Effect from "effect/Effect"

export const validUntil: number = Session.now() + 3600

export const describe = (error: unknown): string => {
  if (error instanceof ChainError.ChainError && error.reason._tag === "Rpc") return `rpc ${error.reason.code}`
  return NameraError.isNameraError(error) ? error.shortMessage : "unknown"
}

export const later: Effect.Effect<number> = Effect.map(EffectSession.now(), (now) => now + 3600)

export const account = (client: KernelAccount.from.Options["client"], owner: KernelAccount.from.Options["owner"]) =>
  KernelAccount.from({ client, owner })

export const sessionsReady = async (client: KernelAccount.from.Options["client"], address: `0x${string}`) => {
  const detected = await SmartAccount.detect(client, { address })
  return detected.type !== "unsupported" && detected.type !== "undeployed" && detected.sessionsInstalled
}

export const agentKey = async () => {
  const store = Keystore.memory()
  const key = await Keystore.create(store, { curve: "secp256k1" })
  return {
    sessionKey: SessionKey.ecdsa(Key.address(key, "eip155")),
    account: await Keystore.toAccount(store, { id: key.id })
  }
}

export const effectKey = EffectKeystore.create(EffectKeystore.memory(), { curve: "secp256k1" })
