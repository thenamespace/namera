import { assert, describe, it } from "@effect/vitest"
import { Bundler, KernelAccount, Paymaster } from "@namera-ai/sdk"
import { createPublicClient, encodeAbiParameters, type Hex, http, maxUint256, slice, toFunctionSelector } from "viem"
import {
  createBundlerClient,
  type GetPaymasterDataParameters,
  type GetPaymasterStubDataParameters,
  type UserOperationRequest
} from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { parseErc6492Signature } from "viem/utils"

import { type Call, endpoint } from "./endpoint.test-utils.ts"

const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
const CIRCLE = "0x31BE08D380A21fc740883c0BC434FcFc88740b58"
const NONCE = 7n

// A Base Sepolia node for an undeployed Kernel account: no code anywhere, and USDC's permit reads.
const node = (call: Call) => {
  if (call.method === "eth_chainId") return { result: "0x14a34" }
  if (call.method === "eth_getCode") return { result: "0x" }
  if (call.method === "eth_call") {
    const { data, to } = call.params[0] as { readonly to: string; readonly data: Hex }
    if (to.toLowerCase() === USDC.toLowerCase()) {
      const selector = slice(data, 0, 4)
      if (selector === toFunctionSelector("name()")) {
        return { result: encodeAbiParameters([{ type: "string" }], ["USDC"]) }
      }
      if (selector === toFunctionSelector("version()")) {
        return { result: encodeAbiParameters([{ type: "string" }], ["2"]) }
      }
      if (selector === toFunctionSelector("nonces(address)")) {
        return { result: encodeAbiParameters([{ type: "uint256" }], [NONCE]) }
      }
    }
  }
  return { error: { code: -32601, message: `unexpected ${call.method}` } }
}

const kernel = async () => {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http("https://node.example", endpoint(node).http)
  })
  return KernelAccount.from({ client, owner: privateKeyToAccount(generatePrivateKey()), sessions: false })
}

const decode = (paymasterData: Hex) => ({
  mode: Number(slice(paymasterData, 0, 1)),
  token: slice(paymasterData, 1, 21),
  amount: BigInt(slice(paymasterData, 21, 53)),
  signature: slice(paymasterData, 53)
})

const permit = (owner: Hex, value: bigint) => ({
  domain: { name: "USDC", version: "2", chainId: baseSepolia.id, verifyingContract: USDC },
  types: {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" }
    ]
  },
  primaryType: "Permit",
  message: { owner, spender: CIRCLE, value, nonce: NONCE, deadline: maxUint256 }
} as const)

const operation = (sender: Hex) => ({
  chainId: baseSepolia.id,
  entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  sender,
  nonce: 0n,
  callData: "0x",
  maxFeePerGas: 10_000_000n,
  maxPriorityFeePerGas: 1_000n,
  signature: "0x"
} as const)

describe("Paymaster.circle", () => {
  it("attaches a permit of maxAmount, signed by the account, for the stub", async () => {
    const account = await kernel()
    const stub = await Paymaster.circle({ token: "USDC", maxAmount: 2_000000n, account }).getPaymasterStubData(
      operation(account.address) as GetPaymasterStubDataParameters
    ) as {
      readonly paymaster: Hex
      readonly paymasterData: Hex
      readonly paymasterVerificationGasLimit: bigint
      readonly paymasterPostOpGasLimit: bigint
      readonly isFinal: boolean
    }

    const data = decode(stub.paymasterData)
    // The counterfactual account's ERC-6492 wrapper is removed: the paymaster checks it after deployment.
    const expected = parseErc6492Signature(await account.signTypedData(permit(account.address, 2_000000n))).signature

    assert.deepInclude(stub, {
      paymaster: CIRCLE,
      paymasterVerificationGasLimit: 200_000n,
      paymasterPostOpGasLimit: 50_000n
    })
    assert.isFalse(stub.isFinal)
    assert.deepStrictEqual({ ...data, token: data.token.toLowerCase() }, {
      mode: 0,
      token: USDC.toLowerCase(),
      amount: 2_000000n,
      signature: expected
    })
  })

  it("permits the operation's worst-case cost plus 20%, at most maxAmount, for the operation sent", async () => {
    const account = await kernel()
    const circle = Paymaster.circle({ token: "USDC", account })
    const amountFor = async (gas: bigint) => {
      const data = await circle.getPaymasterData({
        ...operation(account.address),
        callGasLimit: gas,
        verificationGasLimit: 300_000n,
        preVerificationGas: 100_000n,
        paymaster: CIRCLE,
        paymasterVerificationGasLimit: 200_000n,
        paymasterPostOpGasLimit: 50_000n
      } as GetPaymasterDataParameters) as { readonly paymasterData: Hex }
      return decode(data.paymasterData).amount
    }

    // 700k gas at 0.01 gwei, priced at 20,000 USDC per ether: 140,000 units, plus 20%.
    assert.strictEqual(await amountFor(50_000n), 168_000n)
    // 1 USDC by default at most.
    assert.strictEqual(await amountFor(10_000_000n), 1_000000n)
  })

  it("signs with the account a bundler helper prepared the operation for", async () => {
    const account = await kernel()
    const circle = Paymaster.circle({ token: "USDC" })
    const fees = { fast: { maxFeePerGas: "0x1", maxPriorityFeePerGas: "0x1" } }
    const bundler = Bundler.pimlico({ apiKey: "pim_test", http: endpoint(() => ({ result: fees })).http })
    const bundlerClient = createBundlerClient({ account, client: account.client, ...bundler, paymaster: circle })

    const unbound = await circle.getPaymasterStubData(operation(account.address) as GetPaymasterStubDataParameters)
      .then(() => assert.fail("expected a refusal"), (cause: unknown) => cause as Error)
    assert.include(unbound.message, "needs the account")

    await bundler.userOperation.estimateFeesPerGas({
      account,
      bundlerClient,
      userOperation: {} as UserOperationRequest
    })
    const stub = await circle.getPaymasterStubData(operation(account.address) as GetPaymasterStubDataParameters) as {
      readonly paymasterData: Hex
    }
    const expected = parseErc6492Signature(await account.signTypedData(permit(account.address, 1_000000n))).signature
    assert.strictEqual(decode(stub.paymasterData).signature, expected)
  })
})
