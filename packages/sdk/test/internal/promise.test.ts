// The Promise boundary is the one internal module tested directly: it is the contract every Promise function shares,
// and no public async function exists yet to carry these cases. They move onto public functions as those arrive.
import { assert, describe, inject, it } from "@effect/vitest"
import { ChainError } from "@namera-ai/sdk"
import { TestChain } from "@namera-ai/sdk/testing"
import { Effect } from "effect"
import { createClient, http, HttpRequestError } from "viem"

import { getChainId } from "@namera-ai/sdk/internal/client"
import { run } from "@namera-ai/sdk/internal/promise"

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected the promise to reject"),
    (error: unknown) => error
  )

describe("run", () => {
  it("resolves with the effect's value", async () => {
    assert.strictEqual(await run(Effect.succeed(42)), 42)
  })

  it("rejects with the same error instance the effect fails with", async () => {
    const error = ChainError.timeout()
    assert.strictEqual(await rejection(run(Effect.fail(error))), error)
  })

  it("rejects with a defect as it is", async () => {
    const defect = new RangeError("bug")
    assert.strictEqual(await rejection(run(Effect.die(defect))), defect)
  })

  it("rejects with the signal's reason, without running, when aborted before the call", async () => {
    let ran = false
    const controller = new AbortController()
    controller.abort(new Error("cancelled"))

    const error = await rejection(run(Effect.sync(() => (ran = true)), { signal: controller.signal }))

    assert.strictEqual(error, controller.signal.reason)
    assert.isFalse(ran)
  })

  it("interrupts the effect and rejects with the signal's reason when aborted mid-flight", async () => {
    const controller = new AbortController()
    let markStarted = () => {}
    const started = new Promise<void>((resolve) => (markStarted = resolve))
    const pending = run(
      Effect.sync(() => markStarted()).pipe(Effect.andThen(Effect.never)),
      { signal: controller.signal }
    )

    await started
    controller.abort(new Error("cancelled"))

    assert.strictEqual(await rejection(pending), controller.signal.reason)
  })

  it("translates a raw viem error that escaped as a defect into a ChainError, keeping it as the cause", async () => {
    const viemError = new HttpRequestError({ url: "http://127.0.0.1:1", details: "fetch failed" })

    const error = await rejection(run(Effect.die(viemError)))

    assert.isTrue(ChainError.isChainError(error))
    assert.strictEqual((error as ChainError.ChainError).reason._tag, "Transport")
    assert.strictEqual((error as ChainError.ChainError).reason.cause, viemError)
  })
})

describe("getChainId", () => {
  it("reads the chain id through the caller's client", async () => {
    const chain = await TestChain.from(inject(TestChain.contextKey))
    const client = createClient({ transport: http(chain.rpcUrl) })

    assert.strictEqual(await run(getChainId(client)), chain.chain.id)
  })

  it("fails with a Transport ChainError naming the method when the node is unreachable", async () => {
    const client = createClient({ transport: http("http://127.0.0.1:1", { retryCount: 0 }) })

    const error = await rejection(run(getChainId(client)))

    assert.isTrue(ChainError.isChainError(error))
    const { metaMessages, reason } = error as ChainError.ChainError
    assert.strictEqual(reason._tag, "Transport")
    assert.deepStrictEqual(metaMessages, ["Method: eth_chainId"])
    assert.instanceOf(reason.cause, HttpRequestError)
  })
})
