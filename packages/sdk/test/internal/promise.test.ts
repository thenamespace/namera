// The Promise boundary's contract is checked through every public function by the conformance suite. These are the
// cases that suite cannot observe: that the rejection is the very instance the effect failed with, a defect, and a
// raw viem error escaping as one.
import { assert, describe, it } from "@effect/vitest"
import { ChainError } from "@namera-ai/sdk"
import { run } from "@namera-ai/sdk/internal/promise"
import { Effect } from "effect"
import { HttpRequestError } from "viem"

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected the promise to reject"),
    (error: unknown) => error
  )

describe("run", () => {
  it("rejects with the same error instance the effect fails with", async () => {
    const error = ChainError.timeout()
    assert.strictEqual(await rejection(run(Effect.fail(error))), error)
  })

  it("rejects with a defect as it is", async () => {
    const defect = new RangeError("bug")
    assert.strictEqual(await rejection(run(Effect.die(defect))), defect)
  })

  it("translates a raw viem error that escaped as a defect into a ChainError, keeping it as the cause", async () => {
    const viemError = new HttpRequestError({ url: "http://127.0.0.1:1", details: "fetch failed" })

    const error = await rejection(run(Effect.die(viemError)))

    assert.isTrue(ChainError.isChainError(error))
    assert.strictEqual((error as ChainError.ChainError).reason._tag, "Transport")
    assert.strictEqual((error as ChainError.ChainError).reason.cause, viemError)
  })
})
