import { assert } from "@effect/vitest"
import { Session } from "@namera-ai/sdk"
import { Session as EffectSession } from "@namera-ai/sdk/effect"
import { Effect } from "effect"

/**
 * How the Promise and Effect forms of an export agree, for every export whose two forms are not the same value.
 * Exports that are the same value in both entries (error classes, pure functions) need no row.
 */
export type Conformance = {
  /** The function has no Promise: both forms return the same value, one directly and one from an Effect. */
  readonly kind: "sync"
  readonly check: () => Promise<void>
}

export const table: Record<string, Conformance> = {
  "Session.now": {
    kind: "sync",
    check: async () => {
      const promise = Session.now()
      const effect = await Effect.runPromise(EffectSession.now())
      assert.isAtMost(Math.abs(effect - promise), 1)
    }
  }
}
