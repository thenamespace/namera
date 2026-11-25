import { ChainError, type NameraError } from "@namera-ai/sdk"
import { describe, expect, it } from "tstyche"

describe("ChainError", () => {
  it("narrows its reason by _tag", () => {
    const error = ChainError.rpc({ code: -32000 })

    expect(error.reason._tag).type.toBe<"Transport" | "Rpc" | "Reverted" | "Timeout">()
    if (error.reason._tag === "Rpc") expect(error.reason.code).type.toBe<number>()
  })

  it("is an Error with viem's error fields, and part of the NameraError union", () => {
    expect<ChainError.ChainError>().type.toBeAssignableTo<Error & NameraError.Fields>()
    expect<ChainError.ChainError>().type.toBeAssignableTo<NameraError.NameraError>()
  })

  it("requires the code of a JSON-RPC error", () => {
    expect(ChainError.rpc).type.not.toBeCallableWith({})
  })
})
