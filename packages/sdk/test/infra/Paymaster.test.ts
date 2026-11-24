import { assert, describe, it } from "@effect/vitest"
import { type CompatError, Paymaster, type PaymasterError } from "@namera-ai/sdk"
import type { GetPaymasterDataParameters, GetPaymasterStubDataParameters } from "viem/account-abstraction"

import { type Answer, type Call, endpoint } from "./endpoint.test-utils.ts"
import * as fixture from "./vendors.fixture.ts"

const key = "SecretKey0123456789abcdef"
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
const PAYMASTER = "0x777777777777AeC03fd955926DbF81597e66834C"

// An operation as viem hands it to a paymaster: before the estimate, gas fields are absent.
const operation = {
  chainId: 84532,
  entryPointAddress: ENTRY_POINT,
  sender: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
  nonce: 0n,
  callData: "0x",
  maxFeePerGas: 1_000_000n,
  maxPriorityFeePerGas: 1_000n,
  signature: "0x"
} as const

const estimated = {
  ...operation,
  callGasLimit: 9_100n,
  verificationGasLimit: 307_010n,
  preVerificationGas: 126_889n,
  paymaster: PAYMASTER,
  paymasterVerificationGasLimit: 150_000n
} as const

const through = (
  make: (http: ReturnType<typeof endpoint>["http"]) => Paymaster.Paymaster,
  answer: (call: Call) => Answer
) => {
  const fake = endpoint(answer)
  return { paymaster: make(fake.http), calls: fake.calls }
}

describe("Paymaster endpoints", () => {
  it("asks each vendor's endpoint for the chain, with its context", async () => {
    const cases = [
      [
        (http) => Paymaster.pimlico({ apiKey: key, policyId: "sp_1", http }),
        `https://api.pimlico.io/v2/84532/rpc?apikey=${key}`,
        { sponsorshipPolicyId: "sp_1" }
      ],
      [(http) => Paymaster.pimlico({ apiKey: key, http }), `https://api.pimlico.io/v2/84532/rpc?apikey=${key}`, {}],
      [
        (http) => Paymaster.pimlicoErc20({ apiKey: key, token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", http }),
        `https://api.pimlico.io/v2/84532/rpc?apikey=${key}`,
        { token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" }
      ],
      [
        (http) => Paymaster.alchemy({ apiKey: key, policyId: "gm_1", http }),
        `https://base-sepolia.g.alchemy.com/v2/${key}`,
        { policyId: "gm_1" }
      ],
      [
        (http) => Paymaster.candide({ apiKey: key, policyId: "cp_1", http }),
        `https://api.candide.dev/api/v3/84532/${key}`,
        { sponsorshipPolicyId: "cp_1" }
      ],
      [
        (http) => Paymaster.candide({ policyId: "cp_1", http }),
        "https://api.candide.dev/public/v3/84532",
        { sponsorshipPolicyId: "cp_1" }
      ],
      [(http) => Paymaster.zerodev({ projectId: key, http }), `https://rpc.zerodev.app/api/v3/${key}/chain/84532`, {}],
      [
        (http) => Paymaster.etherspot({ apiKey: key, http }),
        `https://rpc.etherspot.io/paymaster/?apiKey=${key}&chainId=84532&useVp=true`,
        {}
      ],
      [
        (http) => Paymaster.erc7677({ url: "https://paymaster.example/rpc", context: { mode: "sponsor" }, http }),
        "https://paymaster.example/rpc",
        { mode: "sponsor" }
      ]
    ] as const satisfies ReadonlyArray<
      readonly [(http: ReturnType<typeof endpoint>["http"]) => Paymaster.Paymaster, string, unknown]
    >

    for (const [make, url, context] of cases) {
      const { calls, paymaster } = through(make, () => ({ result: { paymaster: PAYMASTER, paymasterData: "0x" } }))
      await paymaster.getPaymasterStubData(operation as GetPaymasterStubDataParameters)
      assert.strictEqual(calls[0]?.url, url)
      assert.deepStrictEqual(calls[0]?.params.slice(1), [ENTRY_POINT, "0x14a34", context], url)
    }
  })

  it("refuses a chain the vendor has no endpoint for", async () => {
    const { paymaster } = through((http) => Paymaster.alchemy({ apiKey: key, policyId: "gm_1", http }), () => ({
      result: null
    }))
    const error = await paymaster.getPaymasterStubData({ ...operation, chainId: 999 } as GetPaymasterStubDataParameters)
      .then(() => assert.fail("expected a refusal"), (cause: unknown) => cause)

    assert.strictEqual((error as CompatError.CompatError).reason.problems[0]?.code, "NOT_ON_CHAIN")
  })
})

describe("Paymaster ERC-7677 fields", () => {
  it("sends stub requests with zeroed gas fields", async () => {
    const { calls, paymaster } = through((http) => Paymaster.pimlico({ apiKey: key, http }), () => ({
      result: { paymaster: PAYMASTER, paymasterData: "0x01", paymasterVerificationGasLimit: "0x7a120" }
    }))
    await paymaster.getPaymasterStubData(operation as GetPaymasterStubDataParameters)

    assert.deepInclude(calls[0]?.params[0] as object, {
      callGasLimit: "0x0",
      verificationGasLimit: "0x0",
      preVerificationGas: "0x0"
    })
  })

  it("gives a stub without paymaster verification gas 150k, and keeps the paymaster's own", async () => {
    const stub = (answer: Record<string, unknown>) =>
      through((http) => Paymaster.candide({ policyId: "cp_1", http }), () => ({ result: answer })).paymaster
        .getPaymasterStubData(operation as GetPaymasterStubDataParameters)

    assert.deepStrictEqual<unknown>(await stub({ paymaster: PAYMASTER, paymasterData: "0x01" }), {
      paymaster: PAYMASTER,
      paymasterData: "0x01",
      paymasterVerificationGasLimit: 150_000n
    })
    assert.strictEqual(
      (await stub({ paymaster: PAYMASTER, paymasterData: "0x01", paymasterVerificationGasLimit: "0x7a120" }) as {
        readonly paymasterVerificationGasLimit?: bigint
      }).paymasterVerificationGasLimit,
      500_000n
    )
  })

  it("signs the operation as estimated and returns the paymaster's fields unchanged", async () => {
    const signed = { paymaster: PAYMASTER, paymasterData: "0xabcdef", paymasterPostOpGasLimit: "0x1" }
    const { calls, paymaster } = through((http) => Paymaster.pimlico({ apiKey: key, http }), () => ({ result: signed }))
    const data = await paymaster.getPaymasterData(estimated as GetPaymasterDataParameters)

    assert.deepStrictEqual(data, { paymaster: PAYMASTER, paymasterData: "0xabcdef", paymasterPostOpGasLimit: 1n })
    assert.deepInclude(calls[0]?.params[0] as object, {
      callGasLimit: "0x238c",
      verificationGasLimit: "0x4af42",
      preVerificationGas: "0x1efa9",
      paymasterVerificationGasLimit: "0x249f0"
    })
  })

  it("raises the call gas Candide signs for to its minimum, and returns it with the signed fields", async () => {
    const { calls, paymaster } = through((http) => Paymaster.candide({ policyId: "cp_1", http }), () => ({
      result: { paymaster: PAYMASTER, paymasterData: "0xabcdef" }
    }))
    const data = await paymaster.getPaymasterData(estimated as GetPaymasterDataParameters)

    assert.strictEqual((calls[0]!.params[0] as { readonly callGasLimit: string }).callGasLimit, "0x7530")
    assert.deepStrictEqual(data, { paymaster: PAYMASTER, paymasterData: "0xabcdef", callGasLimit: 30_000n } as never)
  })

  it("asks Candide again with the minimum call gas it names when it refuses the floor", async () => {
    const { calls, paymaster } = through(
      (http) => Paymaster.candide({ policyId: "cp_1", http }),
      () =>
        calls.length === 1
          ? { error: { code: -32602, message: fixture.candideCallGasTooLow } }
          : { result: { paymaster: PAYMASTER, paymasterData: "0xabcdef" } }
    )
    const data = await paymaster.getPaymasterData(estimated as GetPaymasterDataParameters)

    assert.deepStrictEqual(
      calls.map((call) => (call.params[0] as { readonly callGasLimit: string }).callGasLimit),
      ["0x7530", "0x86fd"]
    )
    assert.deepStrictEqual(data, { paymaster: PAYMASTER, paymasterData: "0xabcdef", callGasLimit: 34_557n } as never)
  })
})

describe("Paymaster errors", () => {
  const refusal = async (
    make: (http: ReturnType<typeof endpoint>["http"]) => Paymaster.Paymaster,
    code: number,
    message: string
  ) => {
    const { paymaster } = through(make, () => ({ error: { code, message } }))
    return paymaster.getPaymasterData(estimated as GetPaymasterDataParameters).then(
      () => assert.fail("expected a refusal"),
      (cause: unknown) => cause as PaymasterError.PaymasterError
    )
  }

  it("turns vendors' refusals into PaymasterError, without the API key", async () => {
    const inactive = await refusal((http) => Paymaster.pimlico({ apiKey: key, http }), -32602, fixture.policyInactive)
    const unfunded = await refusal(
      (http) => Paymaster.candide({ apiKey: key, policyId: "cp_1", http }),
      -32003,
      fixture.candideUnfunded
    )
    const other = await refusal(
      (http) => Paymaster.etherspot({ apiKey: key, http }),
      -32603,
      fixture.arkaUnsupportedToken
    )

    assert.strictEqual(inactive.reason._tag, "PolicyInactive")
    assert.strictEqual(inactive.vendor, "pimlico")
    assert.strictEqual(unfunded.reason._tag, "InsufficientBalance")
    assert.deepInclude(other.reason, { _tag: "Rejected", vendor: "etherspot", message: fixture.arkaUnsupportedToken })
    for (const error of [inactive, unfunded, other]) {
      assert.notInclude(JSON.stringify([error.message, error.details, error.metaMessages, error.url]), key)
    }
  })
})
