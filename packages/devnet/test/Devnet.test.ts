import { afterEach, assert, beforeEach, describe, inject, it } from "@effect/vitest"
import { External, SmartSession } from "@namera-ai/contracts"
import { Devnet } from "@namera-ai/devnet"
import { toKernelSmartAccount } from "permissionless/accounts"
import { type Hex, zeroAddress } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"
import { privateKeyToAccount } from "viem/accounts"

type CallFrame = { readonly to?: Hex; readonly input?: Hex; readonly type: string; readonly calls?: Array<CallFrame> }

const frames = (frame: CallFrame): Array<CallFrame> => [frame, ...(frame.calls ?? []).flatMap(frames)]

// Precompiles answer calls without code.
const isPrecompile = (address: Hex) => BigInt(address) <= 0x11n

const devnet = await Devnet.from(inject(Devnet.contextKey))
const { client } = devnet

const kernelAccount = () =>
  toKernelSmartAccount({
    client,
    owners: [privateKeyToAccount(devnet.keys[0]!)],
    version: "0.3.3",
    useMetaFactory: false,
    entryPoint: { address: entryPoint07Address, version: "0.7" }
  })

describe("Devnet", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("serves Namera's contracts and every external contract at their production addresses", async () => {
    const addresses = [
      SmartSession.v1.address,
      ...Object.values(External).flatMap((versions) =>
        Object.values(versions).flatMap((contracts) => Object.values(contracts))
      )
    ]
    for (const address of addresses) {
      assert.notStrictEqual(await client.getCode({ address: address as Hex }), undefined, address as string)
    }
  })

  it("deploys a Kernel 3.3 account and runs its first user operation through alto", async () => {
    const account = await kernelAccount()
    await devnet.fund(account.address)

    const { receipt, success } = await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }])

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

  it("reverts to a snapshot, dropping what a test deployed, and bundles again afterwards", async () => {
    const account = await kernelAccount()
    assert.strictEqual(await client.getCode({ address: account.address }), undefined)

    await devnet.fund(account.address)
    assert.isTrue((await devnet.sendUserOperation(account, [{ to: zeroAddress }])).success)
  })

  it("bundles on the first receipt request when asked, so send-and-wait completes", async () => {
    const account = await kernelAccount()
    await devnet.fund(account.address)
    const bundler = devnet.bundlerClient(account, { bundleOnReceipt: true })

    const hash = await bundler.sendUserOperation({ calls: [{ to: zeroAddress }] })
    assert.isTrue((await bundler.waitForUserOperationReceipt({ hash })).success)
  })

  it("sets the next block's timestamp and balances", async () => {
    await devnet.setTime(2_000_000_000)
    await devnet.mine()
    assert.strictEqual((await client.getBlock()).timestamp, 2_000_000_000n)

    await devnet.fund(zeroAddress, 5n)
    assert.strictEqual(await client.getBalance({ address: zeroAddress }), 5n)
  })
})
