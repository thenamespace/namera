import { assert, describe, it } from "@effect/vitest"
import { AccountError, ChainError, SmartAccount } from "@namera-ai/sdk"
import { createPublicClient, http, HttpRequestError } from "viem"
import { entryPoint07Abi, entryPoint07Address } from "viem/account-abstraction"
import { base } from "viem/chains"

// A custom account built from viem's implementation options, as a developer would write one; only the failures matter.
const address = "0x0000000000000000000000000000000000000001"
const implementation = (overrides: Partial<SmartAccount.Implementation> = {}): SmartAccount.Implementation => ({
  client: createPublicClient({ chain: base, transport: http("https://rpc.example.com") }),
  entryPoint: { abi: entryPoint07Abi, address: entryPoint07Address, version: "0.7" },
  getAddress: () => Promise.resolve(address),
  encodeCalls: () => Promise.resolve("0x"),
  getFactoryArgs: () => Promise.resolve({ factory: undefined, factoryData: undefined }),
  getStubSignature: () => Promise.resolve("0x"),
  signMessage: () => Promise.resolve("0x"),
  signTypedData: () => Promise.resolve("0x"),
  signUserOperation: () => Promise.resolve("0x"),
  ...overrides
})

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected a rejection"),
    (error: unknown) => error
  )

describe("SmartAccount.from", () => {
  it("returns viem's smart account for the implementation", async () => {
    const account = await SmartAccount.from(implementation())

    assert.strictEqual(account.address, address)
    assert.strictEqual(account.type, "smart")
  })

  it("turns a signing failure into AccountError SigningFailed, keeping the owner's error as cause", async () => {
    const cause = new Error("user rejected the request")
    const account = await SmartAccount.from(implementation({ signMessage: () => Promise.reject(cause) }))

    const error = await rejection(account.signMessage({ message: "hello" }))
    assert.isTrue(AccountError.isAccountError(error))
    assert.strictEqual((error as AccountError.AccountError).reason._tag, "SigningFailed")
    assert.strictEqual((error as AccountError.AccountError).reason.cause, cause)
  })

  it("turns a viem error from any other method into a ChainError with the client's chain", async () => {
    const cause = new HttpRequestError({ url: "https://rpc.example.com/v2/AbCdEf0123456789SecretKey" })
    const account = await SmartAccount.from(implementation({ getNonce: () => Promise.reject(cause) }))

    const error = await rejection(account.getNonce())
    assert.isTrue(ChainError.isChainError(error))
    assert.strictEqual((error as ChainError.ChainError).chainId, base.id)
    assert.strictEqual((error as ChainError.ChainError).url, "https://rpc.example.com")
  })

  it("fails with AccountError InvalidOptions when viem can't build the account", async () => {
    const error = await rejection(
      SmartAccount.from(implementation({ getAddress: () => Promise.reject(new Error("no address")) }))
    )

    assert.isTrue(AccountError.isAccountError(error))
    assert.strictEqual((error as AccountError.AccountError).reason._tag, "InvalidOptions")
  })
})
