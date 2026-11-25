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

  // RIP-7212's test vector; the precompile answers 1 for a valid signature and nothing for an invalid one.
  it("runs Osaka, with the P-256 precompile passkey validators need", async () => {
    const vector = "0x4cee90eb86eaa050036147a12d49004b6b9c72bd725d39d4785011fe190f0b4d"
      + "a73bd4903f0ce3b639bbbf6e8e80d16931ff4bcf5993d58468e8fb19086e8cac"
      + "36dbcd03009df8c59286b162af3bd7fcc0450c9aa81be5d10d312af6c66b1d60"
      + "4aebd3099c618202fcfe16ae7770b0c49ab5eadf74b754204a3bb6060e44eff3"
      + "7618b065f9832de4ca6ca971a7a1adc826d0f7c00181a5fb2ddf79ae00b4e10e" as Hex
    const p256 = "0x0000000000000000000000000000000000000100"

    assert.strictEqual(BigInt((await client.call({ to: p256, data: vector })).data ?? "0x0"), 1n)
    assert.isUndefined((await client.call({ to: p256, data: `0x00${vector.slice(4)}` })).data)
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
