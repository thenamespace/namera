// A consumer of the SDK's public entries, compiled by `pnpm type-cost` to measure what the SDK costs the type checker.
import { Account, ChainError, KernelAccount, NameraError, Session } from "@namera-ai/sdk"
import { Session as EffectSession } from "@namera-ai/sdk/effect"
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
  const detected = await Account.detect(client, { address })
  return detected.type !== "unsupported" && detected.type !== "undeployed" && detected.sessionsInstalled
}
