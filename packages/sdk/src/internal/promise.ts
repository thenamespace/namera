import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"

import { fromUnknown, isForeign } from "./chainError.ts"
import { isNameraError } from "./nameraError.ts"

/**
 * The options every Promise function accepts besides its own.
 */
export interface RunOptions {
  readonly signal?: AbortSignal | undefined
}

// The one place the Promise API runs effects. Every Promise function goes through it, so they all share one contract:
// an aborted signal rejects with `signal.reason`, typed failures reject with the same error instance the Effect API
// fails with, and a raw viem or ox error that escaped as a defect still rejects as a `ChainError`.
/** @internal */
export const run = <A, E>(effect: Effect.Effect<A, E>, options?: RunOptions): Promise<A> => {
  const signal = options?.signal
  if (signal?.aborted) return Promise.reject(signal.reason)

  return Effect.runPromiseExit(effect, { signal }).then((exit) => {
    if (Exit.isSuccess(exit)) return exit.value
    if (signal?.aborted && Cause.hasInterrupts(exit.cause)) throw signal.reason

    const failure = Cause.squash(exit.cause)
    if (Cause.hasFails(exit.cause) || isNameraError(failure)) throw failure
    if (isForeign(failure)) throw fromUnknown(failure)
    throw failure
  })
}
