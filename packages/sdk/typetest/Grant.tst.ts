import type { Grant } from "@namera-ai/sdk"
import { describe, expect, it } from "tstyche"

describe("Grant", () => {
  it("has exactly the format's fields, none of which can hold a secret", () => {
    expect<keyof Grant.Grant>().type.toBe<
      "version" | "namespace" | "id" | "account" | "accountType" | "session" | "chains" | "summary"
    >()
    expect<keyof Grant.GrantChain>().type.toBe<"chain" | "contracts" | "nonce" | "sessionDigest" | "signature">()
    expect<keyof Grant.Grant["session"]>().type.toBe<
      "signer" | "policies" | "validAfter" | "validUntil" | "salt" | "sponsored" | "unsafe" | "label"
    >()
  })
})
