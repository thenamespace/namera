import { assert, describe, it } from "@effect/vitest"
import { ChainError, NameraError } from "@namera-ai/sdk"

describe("NameraError", () => {
  it("recognises errors from another copy of the package by their marker", () => {
    const fromDuplicateCopy = Object.assign(new Error("timed out"), { [NameraError.TypeId]: NameraError.TypeId })

    assert.isTrue(NameraError.isNameraError(fromDuplicateCopy))
    assert.isFalse(NameraError.isNameraError({ _tag: "ChainError" }))
  })

  it("decodes a Namera error to itself and leaves other failures unchanged", () => {
    const error = ChainError.timeout()
    const other = new TypeError("not a Namera error")

    assert.strictEqual(NameraError.decode(error), error)
    assert.strictEqual(NameraError.decode(other), other)
  })
})
