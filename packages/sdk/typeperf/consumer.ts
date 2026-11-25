// A consumer of the SDK's public entries, compiled by `pnpm type-cost` to measure what the SDK costs the type checker.
import {
  ChainError,
  Grant,
  KernelAccount,
  Key,
  Keystore,
  NameraError,
  Policy,
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

const swap = [{
  type: "function",
  name: "swap",
  stateMutability: "nonpayable",
  inputs: [{ name: "recipient", type: "address" }, { name: "amountIn", type: "uint256" }],
  outputs: []
}] as const

export const session = (agent: `0x${string}`, router: `0x${string}`) =>
  Session.from({
    signer: SessionKey.ecdsa(agent),
    validUntil: Session.expiresIn({ days: 7 }),
    policies: [
      Policy.function({ address: router, abi: swap, functionName: "swap", args: { amountIn: { lte: 50n } } }),
      Policy.rateLimit({ count: 10, period: "hour" })
    ]
  })

export const grant = async (account: SmartAccount.SmartAccount, agent: `0x${string}`, router: `0x${string}`) =>
  Grant.serialize(await Grant.create({ account, session: session(agent, router) }), { format: "token" })
