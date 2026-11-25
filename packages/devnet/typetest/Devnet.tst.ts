import { Devnet } from "@namera-ai/devnet"
import { describe, expect, it } from "tstyche"

describe("Devnet.globalSetup", () => {
  it("is a Vitest global setup without prool's types in its signature", () => {
    expect(Devnet.globalSetup()).type.toBe<Devnet.GlobalSetup>()
  })
})
