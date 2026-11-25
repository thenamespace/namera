import { assert, describe, it } from "@effect/vitest"
import { AccountError, Bundler, Grant, NameraError } from "@namera-ai/sdk"
import { createPublicClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

import { account, grantOf, sessions } from "./grant.test-utils.ts"

// The provider's answers that need no chain: nothing here reaches the unreachable node or bundler, so every answer
// comes from the provider itself.

// Anvil's second development key: the session key of `sessions[0]`.
const sessionKey = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
const unreachable = "http://127.0.0.1:1"
const client = createPublicClient({ chain: base, transport: http(unreachable, { retryCount: 0 }) })
const grant = grantOf(sessions[0]!)

const providerFor = () =>
  Grant.toProvider({ grant, signer: sessionKey, client, bundler: Bundler.from({ url: unreachable }) })

const call = { to: account, value: "0x1" }
const batch = (fields: Record<string, unknown> = {}) => ({
  version: "2.0.0",
  chainId: "0x2105",
  from: account,
  atomicRequired: true,
  calls: [call],
  ...fields
})

/** The provider error a request rejects with: its code, and its data when it has some. */
const refusal = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected a provider error"),
    (error: { readonly code: number; readonly message: string; readonly data?: unknown }) => {
      assert.instanceOf(error, Error)
      assert.isString(error.message)
      return error
    }
  )

describe("Grant.toProvider", () => {
  it("answers the account, the chain and the capabilities", async () => {
    const provider = await providerFor()

    assert.deepStrictEqual(await provider.request({ method: "eth_accounts" }), [account])
    assert.deepStrictEqual(await provider.request({ method: "eth_requestAccounts" }), [account])
    assert.strictEqual(await provider.request({ method: "eth_chainId" }), "0x2105")
    const capabilities = { "0x2105": { atomic: { status: "supported" }, paymasterService: { supported: true } } }
    assert.deepStrictEqual(
      await provider.request({ method: "wallet_getCapabilities", params: [account] }),
      capabilities
    )
    assert.deepStrictEqual(
      await provider.request({ method: "wallet_getCapabilities", params: [account, ["0x1"]] }),
      {}
    )
    assert.strictEqual(
      (await refusal(provider.request({ method: "wallet_getCapabilities", params: [sessionKey.address] })))
        .code,
      4100
    )
  })

  it("emits connect and accountsChanged on the first eth_requestAccounts only", async () => {
    const provider = await providerFor()
    const events: Array<unknown> = []
    const onConnect = (payload: unknown) => events.push(["connect", payload])
    provider.on("connect", onConnect)
    provider.on("accountsChanged", (payload) => events.push(["accountsChanged", payload]))

    await provider.request({ method: "eth_requestAccounts" })
    await provider.request({ method: "eth_requestAccounts" })
    assert.deepStrictEqual(events, [["connect", { chainId: "0x2105" }], ["accountsChanged", [account]]])

    provider.removeListener("connect", onConnect)
    assert.deepStrictEqual(events.length, 2)
  })

  it("stays on its chain", async () => {
    const provider = await providerFor()

    assert.isNull(await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] }))
    assert.strictEqual(
      (await refusal(provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xa" }] }))).code,
      4902
    )
  })

  it("refuses what a session key doesn't sign or send with 4200", async () => {
    const provider = await providerFor()

    for (
      const method of [
        "eth_sendTransaction",
        "eth_sendRawTransaction",
        "eth_sign",
        "eth_signTransaction",
        "wallet_showCallsStatus",
        "wallet_addEthereumChain",
        "anvil_setBalance"
      ]
    ) {
      assert.strictEqual((await refusal(provider.request({ method, params: [] }))).code, 4200, method)
    }
  })

  it("refuses personal_sign with the account's NotSupported error as data", async () => {
    const provider = await providerFor()

    const error = await refusal(provider.request({ method: "personal_sign", params: ["0x1234", account] }))
    assert.strictEqual(error.code, 4200)
    const received = NameraError.fromJSON(error.data)
    assert.isTrue(AccountError.isAccountError(received))
    assert.strictEqual((received as AccountError.AccountError).reason._tag, "NotSupported")
  })

  it("signs typed data only for its own account", async () => {
    const provider = await providerFor()
    const typedData = JSON.stringify({ types: {}, primaryType: "Mail", message: {} })

    const error = await refusal(
      provider.request({ method: "eth_signTypedData_v4", params: [sessionKey.address, typedData] })
    )
    assert.strictEqual(error.code, 4100)
    assert.strictEqual(
      (await refusal(provider.request({ method: "eth_signTypedData_v4", params: [account, "{"] }))).code,
      -32602
    )
  })

  it("checks wallet_sendCalls before sending anything", async () => {
    const provider = await providerFor()
    const send = (request: unknown) => refusal(provider.request({ method: "wallet_sendCalls", params: [request] }))

    const cases: ReadonlyArray<readonly [string, unknown, number]> = [
      ["version 1", batch({ version: "1.0" }), -32602],
      ["another account", batch({ from: sessionKey.address }), 4100],
      ["another chain", batch({ chainId: "0xa" }), 5710],
      ["no calls", batch({ calls: [] }), -32602],
      ["a call without a target", batch({ calls: [{ data: "0x" }] }), -32602],
      ["a call value that isn't hex", batch({ calls: [{ to: account, value: "1" }] }), -32602],
      ["an unknown capability", batch({ capabilities: { auxiliaryFunds: { supported: true } } }), 5700],
      ["an unknown call capability", batch({ calls: [{ ...call, capabilities: { permissions: {} } }] }), 5700],
      ["a paymaster service without a url", batch({ capabilities: { paymasterService: {} } }), -32602]
    ]
    for (const [name, request, code] of cases) {
      assert.strictEqual((await send(request)).code, code, name)
    }

    // An optional capability it doesn't know is ignored: the batch goes on, and fails at the unreachable node.
    const optional = await send(batch({ capabilities: { auxiliaryFunds: { optional: true } } }))
    assert.strictEqual(optional.code, -32603)
    assert.strictEqual(NameraError.fromJSON(optional.data)._tag, "ChainError")
  })

  it("refuses an unknown batch id with 5730", async () => {
    const provider = await providerFor()

    const error = await refusal(provider.request({ method: "wallet_getCallsStatus", params: ["batch-1"] }))
    assert.strictEqual(error.code, 5730)
  })
})
