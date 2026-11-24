import { assert, describe, it } from "@effect/vitest"
import { RateLimitPolicy, SpendPolicy } from "@namera-ai/contracts"
import {
  BundlerError,
  ChainError,
  CompatError,
  NameraError,
  PaymasterError,
  PolicyViolationError
} from "@namera-ai/sdk"
import { createClient, http } from "viem"
import { WaitForUserOperationReceiptTimeoutError } from "viem/account-abstraction"

import { endpoint } from "./infra/endpoint.test-utils.ts"
import * as fixture from "./infra/vendors.fixture.ts"

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

const bundlerUrl = "https://api.pimlico.io/v2/84532/rpc?apikey=pim_SecretKey0123456789"

// A failure as viem throws it: the bundler or paymaster answers with a JSON-RPC error.
const failure = (
  error: { readonly code: number; readonly message: string; readonly data?: unknown },
  options: { readonly method?: string; readonly url?: string } = {}
): Promise<unknown> => {
  const fake = endpoint(() => ({ error }))
  const client = createClient({ transport: http(options.url ?? bundlerUrl, fake.http) })
  return client.request({ method: options.method ?? "eth_sendUserOperation", params: [] } as never).then(
    () => assert.fail("expected the request to fail"),
    (cause: unknown) => cause
  )
}

describe("NameraError.decode", () => {
  it("finds a Namera error in a failure's causes", () => {
    const error = ChainError.timeout()
    const wrapped = Object.assign(new Error("UserOperation failed"), {
      cause: Object.assign(new Error(""), { cause: error })
    })

    assert.strictEqual(NameraError.decode(wrapped), error)
  })

  describe("Smart Sessions reverts", () => {
    it("decodes a rate limit's PolicyViolation to RateLimited", async () => {
      const error = NameraError.decode(
        await failure({ code: -32500, message: fixture.altoPolicyViolation(RateLimitPolicy.v1.address) })
      )

      assert.isTrue(PolicyViolationError.isPolicyViolationError(error))
      assert.strictEqual((error as PolicyViolationError.PolicyViolationError).reason._tag, "RateLimited")
    })

    it("names the policy of a PolicyViolation the revert has no amounts for", async () => {
      const error = NameraError.decode(
        await failure({ code: -32500, message: fixture.altoPolicyViolation(SpendPolicy.v1.address) })
      ) as BundlerError.BundlerError

      assert.isTrue(BundlerError.isBundlerError(error))
      assert.strictEqual(error.reason._tag, "Rejected")
      assert.deepInclude(error.reason, { code: -32500, aa: "AA23", revert: "PolicyViolation(SpendPolicy)" })
    })

    it("names Smart Sessions' other errors, as Alchemy reports them", async () => {
      const error = NameraError.decode(
        await failure({ code: -32500, message: fixture.alchemyNoPoliciesSet })
      ) as BundlerError.BundlerError

      assert.deepInclude(error.reason, { aa: "AA23", revert: "NoPoliciesSet" })
    })

    it.each([
      ["a paymaster the session doesn't allow", fixture.paymasterNotEnabled, "PaymasterNotAllowed"],
      ["a removed session, its revert data as JSON", fixture.revokedSession, "SessionRevoked"],
      ["a replayed enable signature", fixture.replayedEnable, "SessionRevoked"]
    ])("decodes %s to PolicyViolationError", async (_, message, reason) => {
      const error = NameraError.decode(await failure({ code: -32500, message }))

      assert.isTrue(PolicyViolationError.isPolicyViolationError(error))
      assert.strictEqual((error as PolicyViolationError.PolicyViolationError).reason._tag, reason)
    })
  })

  describe("the paymaster bundler allowlist (BundlerNotAllowed)", () => {
    it.each([
      ["as Candide's Python bytes", fixture.candideBundlerNotAllowed, "0x3cfdc212769c890907bce93d3d8c2c53de6a7a89"],
      ["as Etherspot's FailedOpWithRevert", fixture.etherspotBundlerNotAllowed, `0x${"0".repeat(40)}`]
    ])("decodes the revert %s to BundlerBound", async (_, message, bundler) => {
      const error = NameraError.decode(await failure({ code: -32500, message })) as PaymasterError.PaymasterError

      assert.isTrue(PaymasterError.isPaymasterError(error))
      assert.strictEqual(error.reason._tag, "BundlerBound")
      assert.strictEqual((error.reason as PaymasterError.BundlerBound).bundler?.toLowerCase(), bundler)
    })

    it("keeps Alchemy's AA33 without revert data a rejection, with the code", async () => {
      const error = NameraError.decode(
        await failure({ code: -32500, message: fixture.alchemyAa33 })
      ) as BundlerError.BundlerError

      assert.strictEqual(error.reason._tag, "Rejected")
      assert.deepInclude(error.reason, { code: -32500, aa: "AA33" })
      assert.include(error.reason.hint, "Pimlico")
    })
  })

  describe("vendor errors", () => {
    it.each([
      ["an inactive sponsorship policy", -32602, fixture.policyInactive, "PolicyInactive"],
      ["an unfunded Candide policy", -32003, fixture.candideUnfunded, "InsufficientBalance"],
      ["an account without the ERC-20 it pays in", -32500, fixture.pimlicoErc20Unfunded, "InsufficientBalance"]
    ])("decodes %s to PaymasterError", async (_, code, message, reason) => {
      const error = NameraError.decode(await failure({ code, message }, { method: "pm_getPaymasterData" }))

      assert.isTrue(PaymasterError.isPaymasterError(error))
      assert.strictEqual((error as PaymasterError.PaymasterError).reason._tag, reason)
    })

    it.each([
      ["Pimlico", bundlerUrl, -32601, fixture.policyRequired, "pimlico"],
      [
        "Candide",
        "https://api.candide.dev/api/v3/84532/cand0123456789abcdef",
        -32602,
        fixture.candideMinCallGas,
        "candide"
      ],
      [
        "Arka",
        "https://rpc.etherspot.io/paymaster/?apiKey=arka0123456789abcd&chainId=84532&useVp=true",
        -32603,
        fixture.arkaUnsupportedToken,
        "etherspot"
      ]
    ])(
      "decodes %s's other refusals of a paymaster method to Rejected, with the vendor",
      async (_, url, code, message, vendor) => {
        const error = NameraError.decode(await failure({ code, message }, { url, method: "pm_getPaymasterStubData" }))

        assert.isTrue(PaymasterError.isPaymasterError(error))
        assert.deepInclude((error as PaymasterError.PaymasterError).reason, { _tag: "Rejected", vendor, message })
      }
    )

    it("decodes Etherspot refusing an EIP-7702 authorization to CompatError", async () => {
      const error = NameraError.decode(await failure({ code: -32602, message: fixture.etherspot7702 }))

      assert.isTrue(CompatError.isCompatError(error))
      assert.strictEqual((error as CompatError.CompatError).reason.problems[0]?.code, "EIP7702_UNSUPPORTED")
    })

    it("decodes a method the bundler doesn't serve to Unsupported", async () => {
      const error = NameraError.decode(
        await failure({ code: -32600, message: fixture.candideUnsupportedMethod }, {
          method: "eth_maxPriorityFeePerGas"
        })
      ) as BundlerError.BundlerError

      assert.deepInclude(error.reason, { _tag: "Unsupported", method: "eth_maxPriorityFeePerGas" })
    })

    it("decodes an EntryPoint code to Rejected", async () => {
      const error = NameraError.decode(
        await failure({ code: -32500, message: fixture.expired })
      ) as BundlerError.BundlerError

      assert.deepInclude(error.reason, { _tag: "Rejected", code: -32500, aa: "AA22" })
    })

    it("decodes a receipt that never came to Dropped, with the operation's hash", () => {
      const hash = `0x${"ab".repeat(32)}` as const
      const error = NameraError.decode(
        new WaitForUserOperationReceiptTimeoutError({ hash })
      ) as BundlerError.BundlerError

      assert.deepInclude(error.reason, { _tag: "Dropped", hash })
    })

    it("keeps the endpoint's key out of the decoded error", async () => {
      const error = NameraError.decode(
        await failure({ code: -32500, message: fixture.expired })
      ) as BundlerError.BundlerError

      assert.strictEqual(error.vendor, "pimlico")
      assert.strictEqual(error.url, "https://api.pimlico.io/v2/84532/rpc")
      assert.notInclude(JSON.stringify([error.message, error.details, error.metaMessages, error.url]), "SecretKey")
    })

    it("leaves a node's error that isn't a bundler's unchanged", async () => {
      const cause = await failure({ code: -32000, message: "nonce too low" }, {
        method: "eth_sendRawTransaction",
        url: "https://rpc.example.com"
      })

      assert.strictEqual(NameraError.decode(cause), cause)
    })
  })
})
