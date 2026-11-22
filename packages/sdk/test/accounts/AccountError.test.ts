import { assert, describe, it } from "@effect/vitest"
import { AccountError, NameraError } from "@namera-ai/sdk"

describe("AccountError", () => {
  it("names the account it is about and carries viem's error fields", () => {
    const cause = new Error("user rejected the request")
    const error = AccountError.signingFailed({
      account: { type: "kernel", address: "0x0000000000000000000000000000000000000001" },
      cause
    })

    assert.strictEqual(error.reason._tag, "SigningFailed")
    assert.strictEqual(error.shortMessage, "The owner could not sign")
    assert.strictEqual(error.details, "user rejected the request")
    assert.deepStrictEqual(error.metaMessages, ["Account: kernel at 0x0000000000000000000000000000000000000001"])
    assert.strictEqual(error.reason.cause, cause)
  })

  it("reports the implementation an unsupported account runs", () => {
    const error = AccountError.notSupported({
      account: { type: "unknown" },
      implementation: "0x00000000000000000000000000000000000000aa"
    })

    assert.strictEqual(error.reason._tag, "NotSupported")
    assert.strictEqual(
      error.reason._tag === "NotSupported" ? error.reason.implementation : undefined,
      "0x00000000000000000000000000000000000000aa"
    )
  })

  it("is a Namera error, recognised across package copies", () => {
    const error = AccountError.chainMismatch({ account: { type: "nexus" }, expected: 8453, actual: 1 })

    assert.isTrue(AccountError.isAccountError(error))
    assert.isTrue(NameraError.isNameraError(error))
    assert.strictEqual(error.message, "The account is on chain 8453, not 1")
  })
})
