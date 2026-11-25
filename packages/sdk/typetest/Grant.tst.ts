import type { Grant, PolicyViolationError } from "@namera-ai/sdk"
import { describe, expect, it } from "tstyche"
import type { SmartAccount, WebAuthnAccount } from "viem/account-abstraction"
import type { LocalAccount, PrivateKeyAccount } from "viem/accounts"

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

  it("gives the agent a viem smart account, signed by a local account or a passkey", () => {
    expect<ReturnType<typeof Grant.toAccount>>().type.toBe<Promise<SmartAccount>>()
    expect<PrivateKeyAccount>().type.toBeAssignableTo<Grant.toAccount.Signer>()
    expect<LocalAccount>().type.toBeAssignableTo<Grant.toAccount.Signer>()
    expect<WebAuthnAccount>().type.toBeAssignableTo<Grant.toAccount.Signer>()
    expect<ReadonlyArray<PrivateKeyAccount>>().type.toBeAssignableTo<Grant.toAccount.Options["signer"]>()
  })

  it("reports a dry run's violations as the error's reasons", () => {
    expect<Grant.check.Result["violations"][number]>().type.toBe<PolicyViolationError.PolicyViolationReason>()
    expect<PolicyViolationError.PolicyViolationError["reason"]>().type.toBe<
      PolicyViolationError.PolicyViolationReason
    >()
  })
})
