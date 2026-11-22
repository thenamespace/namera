import { assert, describe, it } from "@effect/vitest"
import { Session } from "@namera-ai/sdk"
import { Session as EffectSession } from "@namera-ai/sdk/effect"
import { Effect } from "effect"
import { TestClock } from "effect/testing"

describe("Session.now", () => {
  it.effect("returns whole seconds, rounding down", () =>
    Effect.gen(function*() {
      yield* TestClock.setTime(1_700_000_000_999)
      assert.strictEqual(yield* EffectSession.now(), 1_700_000_000)
    }))

  it("reads the system clock in the Promise API", () => {
    const before = Math.floor(Date.now() / 1000)
    const now = Session.now()
    const after = Math.floor(Date.now() / 1000)

    assert.isTrue(Number.isInteger(now))
    assert.isAtLeast(now, before)
    assert.isAtMost(now, after)
  })
})
