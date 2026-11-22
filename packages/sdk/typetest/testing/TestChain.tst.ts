import { TestChain } from "@namera-ai/sdk/testing"
import { describe, expect, it } from "tstyche"

describe("TestChain.globalSetup", () => {
  it("is a Vitest global setup without prool's types in its signature", () => {
    expect(TestChain.globalSetup()).type.toBe<TestChain.GlobalSetup>()
  })
})
