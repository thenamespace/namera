import { ChainError, NameraError, Session } from "@namera-ai/sdk"
import { Session as EffectSession } from "@namera-ai/sdk/effect"
import { Effect, Schema } from "effect"
// Not the `effect/testing` barrel: its TestSchema imports node:assert, which workerd and browsers lack.
import * as TestClock from "effect/testing/TestClock"

/**
 * Exercises the SDK's runtime surface (clock, Schema-backed errors and their encoding, the Effect API, abort signals)
 * and returns what it observed, so every runtime is checked against the same expectations.
 */
export const smoke = async (): Promise<Record<string, unknown>> => {
  const error = ChainError.rpc({ code: -32601, method: "eth_chainId" })
  const encoded = Schema.encodeSync(ChainError.ChainError)(error)
  const controller = new AbortController()
  controller.abort(new Error("cancelled"))

  const before = Math.floor(Date.now() / 1000)
  const now = Session.now()

  return {
    nowIsCurrent: now >= before && now <= Math.floor(Date.now() / 1000) + 1,
    effectNow: await Effect.runPromise(
      Effect.gen(function*() {
        yield* TestClock.setTime(1_700_000_000_500)
        return yield* EffectSession.now()
      }).pipe(Effect.provide(TestClock.layer()))
    ),
    message: error.message,
    isError: error instanceof Error,
    isNameraError: NameraError.isNameraError(error),
    encodedReason: encoded.reason._tag,
    decodedCode: (Schema.decodeSync(ChainError.ChainError)(encoded).reason as ChainError.Rpc).code,
    abortReason: controller.signal.reason instanceof Error ? controller.signal.reason.message : undefined
  }
}

/** What `smoke` returns on every supported runtime. */
export const expected: Record<string, unknown> = {
  nowIsCurrent: true,
  effectNow: 1_700_000_000,
  message: "The node rejected the request with code -32601",
  isError: true,
  isNameraError: true,
  encodedReason: "Rpc",
  decodedCode: -32601,
  abortReason: "cancelled"
}
