import { assert, describe, it } from "@effect/vitest"
import { Bundler, BundlerError, ChainError, CompatError, KernelAccount, NameraError, Paymaster } from "@namera-ai/sdk"
import { type Chain, createPublicClient, http } from "viem"
import { createBundlerClient, getUserOperationError, type UserOperationRequest } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { base, baseSepolia, mainnet } from "viem/chains"

import { type Answer, type Call, endpoint } from "./endpoint.test-utils.ts"
import * as fixture from "./vendors.fixture.ts"

const key = "SecretKey0123456789abcdef"

const urlOf = (bundler: Bundler.Bundler, chain: Chain = baseSepolia) =>
  (bundler.transport({ chain }).value as { readonly url: string }).url

// The fees a bundler client's hook offers, through an endpoint answering from `answer`.
const feesThrough = (
  make: (http: ReturnType<typeof endpoint>["http"]) => Bundler.Bundler,
  answer: (call: Call) => Answer,
  options: { readonly paymaster?: Paymaster.Paymaster } = {}
) => {
  const fake = endpoint(answer)
  const bundler = make(fake.http)
  const bundlerClient = createBundlerClient({ chain: baseSepolia, ...bundler, paymaster: options.paymaster })
  const fees = bundler.userOperation.estimateFeesPerGas({
    account: undefined,
    bundlerClient,
    userOperation: {} as UserOperationRequest
  })
  return { fees, calls: fake.calls }
}

describe("Bundler endpoints", () => {
  it("builds each vendor's URL for the client's chain", () => {
    assert.strictEqual(urlOf(Bundler.pimlico({ apiKey: key })), `https://api.pimlico.io/v2/84532/rpc?apikey=${key}`)
    assert.strictEqual(urlOf(Bundler.alchemy({ apiKey: key })), `https://base-sepolia.g.alchemy.com/v2/${key}`)
    assert.strictEqual(urlOf(Bundler.alchemy({ apiKey: key }), base), `https://base-mainnet.g.alchemy.com/v2/${key}`)
    assert.strictEqual(urlOf(Bundler.candide({ apiKey: key })), `https://api.candide.dev/api/v3/84532/${key}`)
    assert.strictEqual(urlOf(Bundler.candide()), "https://api.candide.dev/public/v3/84532")
    assert.strictEqual(urlOf(Bundler.zerodev({ projectId: key })), `https://rpc.zerodev.app/api/v3/${key}/chain/84532`)
    assert.strictEqual(
      urlOf(Bundler.zerodev({ projectId: key, sponsorship: "ultra-relay" })),
      `https://rpc.zerodev.app/api/v3/${key}/chain/84532?provider=ULTRA_RELAY`
    )
    assert.strictEqual(urlOf(Bundler.etherspot({ apiKey: key })), `https://rpc.etherspot.io/v2/84532?api-key=${key}`)
    assert.strictEqual(urlOf(Bundler.from({ url: "https://bundler.example/rpc" })), "https://bundler.example/rpc")
  })

  it("refuses a chain the vendor has no endpoint for, and a client without a chain", () => {
    const refusal = (thunk: () => unknown) => {
      try {
        thunk()
      } catch (error) {
        return (error as CompatError.CompatError).reason.problems[0]?.code
      }
      return assert.fail("expected a refusal")
    }

    assert.strictEqual(refusal(() => urlOf(Bundler.alchemy({ apiKey: key }), { ...mainnet, id: 999 })), "NOT_ON_CHAIN")
    assert.strictEqual(refusal(() => Bundler.pimlico({ apiKey: key }).transport({})), "NOT_ON_CHAIN")
  })
})

describe("Bundler fees", () => {
  it("reads each vendor's fee method", async () => {
    const cases = [
      [(http) => Bundler.pimlico({ apiKey: key, http }), "pimlico_getUserOperationGasPrice", fixture.pimlicoGasPrice, {
        maxFeePerGas: 0x1566d802n,
        maxPriorityFeePerGas: 0x25cbb01n
      }],
      [(http) => Bundler.zerodev({ projectId: key, http }), "zd_getUserOperationGasPrice", fixture.pimlicoGasPrice, {
        maxFeePerGas: 0x1566d802n,
        maxPriorityFeePerGas: 0x25cbb01n
      }],
      [(http) => Bundler.candide({ http }), "voltaire_feesPerGas", fixture.candideFees, {
        maxFeePerGas: 0xebd30b0n,
        maxPriorityFeePerGas: 0x4d4cn
      }],
      [(http) => Bundler.etherspot({ apiKey: key, http }), "skandha_getGasPrice", fixture.etherspotGasPrice, {
        maxFeePerGas: 0xebd23cdn,
        maxPriorityFeePerGas: 0x406an
      }]
    ] as const satisfies ReadonlyArray<
      readonly [(http: ReturnType<typeof endpoint>["http"]) => Bundler.Bundler, string, unknown, unknown]
    >

    for (const [make, method, answer, expected] of cases) {
      const { calls, fees } = feesThrough(make, () => ({ result: answer }))
      assert.deepStrictEqual(await fees, expected, method)
      assert.deepStrictEqual(calls.map((call) => call.method), [method])
    }
  })

  it("prices Alchemy's priority fee 30% up, over twice the base fee", async () => {
    const { fees } = feesThrough(
      (http) => Bundler.alchemy({ apiKey: key, http }),
      (call) =>
        call.method === "rundler_maxPriorityFeePerGas"
          ? { result: "0x64" }
          : { result: { number: "0x1", baseFeePerGas: "0x3e8" } }
    )

    assert.deepStrictEqual(await fees, { maxFeePerGas: 2130n, maxPriorityFeePerGas: 130n })
  })

  it("offers zero fees for a bundler's own sponsorship, without asking it", async () => {
    for (
      const make of [
        (http: ReturnType<typeof endpoint>["http"]) =>
          Bundler.alchemy({ apiKey: key, sponsorship: { policyId: "policy" }, http }),
        (http: ReturnType<typeof endpoint>["http"]) =>
          Bundler.zerodev({ projectId: key, sponsorship: "ultra-relay", http })
      ]
    ) {
      const { calls, fees } = feesThrough(make, () => ({ result: null }))
      assert.deepStrictEqual(await fees, { maxFeePerGas: 0n, maxPriorityFeePerGas: 0n })
      assert.deepStrictEqual(calls, [])
    }
  })

  it("fails with a ChainError when the fee method answers in another shape", async () => {
    const { fees } = feesThrough((http) => Bundler.candide({ http }), () => ({ result: { fast: "0x1" } }))
    const error = await fees.then(() => assert.fail("expected a failure"), (cause: unknown) => cause)

    assert.isTrue(ChainError.isChainError(error))
    assert.strictEqual((error as ChainError.ChainError).reason._tag, "Transport")
  })
})

describe("Bundler compatibility", () => {
  it("refuses a paymaster the bundler can't send for, before asking for fees", async () => {
    const { calls, fees } = feesThrough(
      (http) => Bundler.candide({ http }),
      () => ({ result: fixture.candideFees }),
      { paymaster: Paymaster.pimlico({ apiKey: key }) }
    )
    const error = await fees.then(() => assert.fail("expected a refusal"), (cause: unknown) => cause)

    assert.isTrue(CompatError.isCompatError(error))
    assert.strictEqual((error as CompatError.CompatError).reason.problems[0]?.code, "PAYMASTER_BUNDLER_BOUND")
    assert.deepStrictEqual(calls, [])
  })

  it("sends anyway with strict: false", async () => {
    const { fees } = feesThrough(
      (http) => Bundler.candide({ http, strict: false }),
      () => ({ result: fixture.candideFees }),
      { paymaster: Paymaster.pimlico({ apiKey: key }) }
    )

    assert.deepStrictEqual(await fees, { maxFeePerGas: 0xebd30b0n, maxPriorityFeePerGas: 0x4d4cn })
  })
})

describe("Bundler with an EIP-7702 account", () => {
  const account = (code: `0x${string}`) =>
    KernelAccount.fromEip7702({
      client: createPublicClient({
        chain: baseSepolia,
        transport: http(
          "https://node.example",
          endpoint((call) =>
            call.method === "eth_getCode"
              ? { result: code }
              : call.method === "eth_chainId"
              ? { result: "0x14a34" }
              : { error: { code: -32601, message: call.method } }
          ).http
        )
      }),
      owner: privateKeyToAccount(generatePrivateKey())
    })

  const fees = async (code: `0x${string}`) => {
    const bundler = Bundler.etherspot({
      apiKey: key,
      http: endpoint(() => ({ result: fixture.etherspotGasPrice })).http
    })
    const delegated = await account(code)
    return bundler.userOperation.estimateFeesPerGas({
      account: delegated,
      bundlerClient: createBundlerClient({ account: delegated, client: delegated.client, ...bundler }),
      userOperation: {} as UserOperationRequest
    }).then((value) => value, (cause: unknown) => cause)
  }

  it("refuses Etherspot until the account is delegated", async () => {
    const undelegated = await fees("0x")

    assert.strictEqual((undelegated as CompatError.CompatError).reason.problems[0]?.code, "EIP7702_UNSUPPORTED")
    assert.deepStrictEqual(await fees("0xef0100d6cedde84be40893d153be9d467cd6ad37875b28"), {
      maxFeePerGas: 0xebd23cdn,
      maxPriorityFeePerGas: 0x406an
    })
  })
})

describe("Bundler estimates", () => {
  const estimate = async (bundler: Bundler.Bundler, operation: Record<string, unknown>) =>
    bundler.transport({ chain: baseSepolia }).request({
      method: "eth_estimateUserOperationGas",
      params: [operation, "0x0000000071727De22E5E9d8BAf0edAc6f37da032"]
    } as never)

  const estimated = { callGasLimit: "0x1dcf", verificationGasLimit: "0x42c20", preVerificationGas: "0x13abb" }

  // Candide's bundler wants 2,000 verification gas spare: an agent's operation with Candide's paymaster had 1,533 at
  // its estimate (Base Sepolia, 2026-11-25), so the helper adds 5,000.
  it("fills the paymaster gas Candide's estimate leaves out, and pads its verification gas", async () => {
    const fake = endpoint(() => ({ result: estimated }))
    const bundler = Bundler.candide({ http: fake.http })
    const padded = { ...estimated, verificationGasLimit: "0x43fa8" }

    assert.deepStrictEqual(await estimate(bundler, { paymaster: "0x777777777777AeC03fd955926DbF81597e66834C" }), {
      ...padded,
      paymasterVerificationGasLimit: "0x249f0"
    })
    assert.deepStrictEqual(
      await estimate(bundler, {
        paymaster: "0x777777777777AeC03fd955926DbF81597e66834C",
        paymasterVerificationGasLimit: "0x30d40",
        paymasterPostOpGasLimit: "0xc350"
      }),
      { ...padded, paymasterVerificationGasLimit: "0x30d40", paymasterPostOpGasLimit: "0xc350" }
    )
    assert.deepStrictEqual(await estimate(bundler, {}), padded)
  })

  it("sends Alchemy's sponsorship policy as a header, with no preVerificationGas", async () => {
    const fake = endpoint(() => ({ result: estimated }))
    const bundler = Bundler.alchemy({ apiKey: key, sponsorship: { policyId: "policy-1" }, http: fake.http })

    assert.deepStrictEqual(await estimate(bundler, {}), { ...estimated, preVerificationGas: "0x0" })
    assert.strictEqual(fake.calls[0]?.headers["x-alchemy-policy-id"], "policy-1")
  })
})

describe("Bundler errors", () => {
  const request = (answer: Answer) => {
    const fake = endpoint(() => answer)
    return Bundler.pimlico({ apiKey: key, http: fake.http }).transport({ chain: baseSepolia }).request({
      method: "eth_sendUserOperation",
      params: []
    } as never).then(() => assert.fail("expected a failure"), (cause: unknown) => cause)
  }

  const leaks = (error: unknown) =>
    JSON.stringify(error).includes(key) || String(error).includes(key)
    || JSON.stringify((error as { metaMessages?: unknown }).metaMessages).includes(key)
    || String((error as { details?: unknown }).details).includes(key)

  it("decodes a rejection, without the API key", async () => {
    const error = await request({
      error: { code: -32500, message: `${fixture.expired} at https://api.pimlico.io/v2/84532/rpc?apikey=${key}` }
    })

    assert.isTrue(BundlerError.isBundlerError(error))
    assert.deepInclude((error as BundlerError.BundlerError).reason, { _tag: "Rejected", aa: "AA22" })
    assert.strictEqual((error as BundlerError.BundlerError).url, "https://api.pimlico.io/v2/84532/rpc")
    assert.isFalse(leaks(error))
  })

  // Captured from Alchemy's bundler sponsorship with a Gas Manager policy of the paymaster type (Base Sepolia,
  // 2026-11-25): viem's bundler actions read it with `getUserOperationError`, which walks it for a JSON-RPC code when
  // its message names no EntryPoint code.
  it("fails viem's bundler actions with the decoded error as the cause, not a TypeError", async () => {
    const error = await request({
      error: { code: -32602, message: "Policy with ID 'gm_1' does not support bundler sponsorship" }
    })
    const thrown = getUserOperationError(error as never, {} as never)
    const decoded = NameraError.decode(thrown)

    assert.isTrue(BundlerError.isBundlerError(decoded))
    assert.deepInclude((decoded as BundlerError.BundlerError).reason, { _tag: "Rejected", code: -32602 })
  })

  it("turns an HTTP failure into a ChainError, without the API key", async () => {
    const error = await request({ status: 401, body: `invalid apikey ${key}` })

    assert.isTrue(ChainError.isChainError(error))
    assert.isFalse(leaks(error))
  })
})
