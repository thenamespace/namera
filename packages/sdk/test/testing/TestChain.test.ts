import { afterEach, assert, beforeEach, describe, inject, it } from "@effect/vitest"
import { SmartSession } from "@namera-ai/contracts"
import { TestChain } from "@namera-ai/sdk/testing"
import { toKernelSmartAccount } from "permissionless/accounts"
import { createPublicClient, type Hex, http, parseEther, zeroAddress } from "viem"
import { createBundlerClient, entryPoint07Address } from "viem/account-abstraction"
import { privateKeyToAccount } from "viem/accounts"

type CallFrame = { readonly to?: Hex; readonly input?: Hex; readonly type: string; readonly calls?: Array<CallFrame> }

const frames = (frame: CallFrame): Array<CallFrame> => [frame, ...(frame.calls ?? []).flatMap(frames)]

// Precompiles answer calls without code.
const isPrecompile = (address: Hex) => BigInt(address) <= 0x11n

const chain = await TestChain.from(inject(TestChain.contextKey))
const client = createPublicClient({ chain: chain.chain, transport: http(chain.rpcUrl) })

const kernelAccount = () =>
  toKernelSmartAccount({
    client,
    owners: [privateKeyToAccount(chain.keys[0]!)],
    version: "0.3.3",
    useMetaFactory: false,
    entryPoint: { address: entryPoint07Address, version: "0.7" }
  })

describe("TestChain", { concurrent: false }, () => {
  let snapshot: Hex
  beforeEach(async () => {
    snapshot = await chain.snapshot()
  })
  afterEach(() => chain.revert(snapshot))

  it("serves Namera's contracts at their production addresses", async () => {
    assert.notStrictEqual(await client.getCode({ address: SmartSession.v1.address }), undefined)
  })

  it("deploys a Kernel 3.3 account and runs its first user operation through alto", async () => {
    const account = await kernelAccount()
    const bundler = createBundlerClient({ account, client, transport: http(chain.bundlerUrl) })
    await client.request({
      method: "anvil_setBalance" as "eth_chainId",
      params: [account.address, `0x${parseEther("1").toString(16)}`] as never
    })

    const hash = await bundler.sendUserOperation({ calls: [{ to: zeroAddress, value: 1n }] })
    await chain.sendBundleNow()
    const { receipt, success } = await bundler.waitForUserOperationReceipt({ hash })

    assert.isTrue(success)
    assert.notStrictEqual(await client.getCode({ address: account.address }), undefined)

    const trace = await client.request({
      method: "debug_traceTransaction" as "eth_chainId",
      params: [receipt.transactionHash, { tracer: "callTracer" }] as never
    }) as unknown as CallFrame
    const emptyTargets: Array<Hex> = []
    for (const frame of frames(trace)) {
      if (frame.to === undefined || frame.input === undefined || frame.input === "0x" || isPrecompile(frame.to)) {
        continue
      }
      if (await client.getCode({ address: frame.to }) === undefined) emptyTargets.push(frame.to)
    }
    assert.deepStrictEqual(emptyTargets, [])
  })

  it("reverts to a snapshot, dropping what a test deployed", async () => {
    const account = await kernelAccount()
    assert.strictEqual(await client.getCode({ address: account.address }), undefined)
  })

  it("sets the next block's timestamp", async () => {
    await chain.setTime(2_000_000_000)
    await chain.mine()
    assert.strictEqual((await client.getBlock()).timestamp, 2_000_000_000n)
  })
})
