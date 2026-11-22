import { assert, describe, it } from "@effect/vitest"
import { ChainError, NameraError } from "@namera-ai/sdk"

describe("ChainError", () => {
  it("carries viem's error fields, with the cause's message as details", () => {
    const cause = new Error("connect ECONNREFUSED 127.0.0.1:1")
    const error = ChainError.transport({ method: "eth_chainId", url: "http://127.0.0.1:1", cause })

    assert.strictEqual(error._tag, "ChainError")
    assert.strictEqual(error.reason._tag, "Transport")
    assert.strictEqual(error.message, "The chain could not be reached")
    assert.strictEqual(error.shortMessage, error.message)
    assert.strictEqual(error.details, "connect ECONNREFUSED 127.0.0.1:1")
    assert.deepStrictEqual(error.metaMessages, ["Method: eth_chainId"])
    assert.match(error.version, /^@namera-ai\/sdk@\d+\.\d+\.\d+/)
    assert.strictEqual(error.cause, error.reason)
    assert.strictEqual(error.reason.cause, cause)
  })

  it("adds the detail to the reason's message", () => {
    assert.strictEqual(
      ChainError.rpc({ code: -32602, detail: "invalid params" }).message,
      "The node rejected the request with code -32602: invalid params"
    )
  })

  it("is an Error and a Namera error, recognised by both guards", () => {
    const error = ChainError.reverted({ data: "0x08c379a0" })

    assert.instanceOf(error, Error)
    assert.isTrue(ChainError.isChainError(error))
    assert.isTrue(NameraError.isNameraError(error))
    assert.isFalse(ChainError.isChainError(new Error("boom")))
  })
})
