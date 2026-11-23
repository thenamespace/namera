import { assert, describe, it } from "@effect/vitest"
import { isPrecompileAnswer } from "@namera-ai/sdk/internal/core/account/webauthn"

describe("the P-256 precompile probe", () => {
  it("counts only an answer of 1 as the precompile", () => {
    assert.isTrue(isPrecompileAnswer(`0x${"00".repeat(31)}01`))
    assert.isFalse(isPrecompileAnswer(`0x${"00".repeat(31)}02`))
    assert.isFalse(isPrecompileAnswer(`0x${"00".repeat(32)}`))
    // No code at 0x100 answers with empty data; a node without the precompile may answer nothing.
    assert.isFalse(isPrecompileAnswer("0x"))
    assert.isFalse(isPrecompileAnswer(undefined))
  })
})
