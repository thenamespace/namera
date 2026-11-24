import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { External, SmartSession } from "@namera-ai/contracts"
import { AccountError, KernelAccount, SmartAccount } from "@namera-ai/sdk"
import { toKernelSmartAccount } from "permissionless/accounts"
import { pad, zeroAddress } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"

import { client, devnet, newOwner } from "./accounts.test-utils.ts"

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected a rejection"),
    (error: unknown) => error
  )

describe("SmartAccount", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("detects an account another SDK deployed and connects to it", async () => {
    const owner = newOwner()
    const deployedElsewhere = await toKernelSmartAccount({
      client,
      owners: [owner],
      version: "0.3.3",
      index: 9n,
      entryPoint: { address: entryPoint07Address, version: "0.7" }
    })
    await devnet.fund(deployedElsewhere.address)
    await devnet.sendUserOperation(deployedElsewhere, [{ to: zeroAddress }])

    assert.deepStrictEqual(await SmartAccount.detect(client, { address: deployedElsewhere.address }), {
      type: "kernel",
      version: "3.3",
      eip7702: false,
      implementation: External.kernel["3.3"].implementation.toLowerCase() as `0x${string}`,
      sessionsInstalled: false
    })

    const account = await SmartAccount.fromAddress({ client, address: deployedElsewhere.address, owner })
    assert.strictEqual(account.namera.type, "kernel")
    assert.isTrue((await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }])).success)
  })

  it("detects EIP-7702 delegations and reports undeployed addresses", async () => {
    const owner = newOwner()
    const account = await KernelAccount.fromEip7702({ client, owner })
    await devnet.fund(owner.address)
    await devnet.sendUserOperation(account, [{ to: zeroAddress }])

    const detected = await SmartAccount.detect(client, { address: owner.address })
    assert.deepInclude(detected, { type: "kernel", version: "3.3", eip7702: true, sessionsInstalled: true })
    assert.deepStrictEqual(await SmartAccount.detect(client, { address: newOwner().address }), { type: "undeployed" })
  })

  it("rejects an account whose implementation isn't Kernel 3.3, naming the implementation", async () => {
    // An ERC-1967 proxy to another implementation (any contract will do).
    const address = newOwner().address
    const owner = newOwner()
    const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
    await client.request({ method: "anvil_setCode" as never, params: [address, "0x00"] as never })
    await client.request({
      method: "anvil_setStorageAt" as never,
      params: [address, implementationSlot, pad(SmartSession.v1.address)] as never
    })

    assert.deepStrictEqual(await SmartAccount.detect(client, { address }), {
      type: "unsupported",
      implementation: SmartSession.v1.address.toLowerCase() as `0x${string}`
    })
    const error = await rejection(SmartAccount.fromAddress({ client, address, owner }))
    assert.isTrue(AccountError.isAccountError(error))
    assert.strictEqual((error as AccountError.AccountError).reason._tag, "NotSupported")
  })

  it("installs Smart Sessions through the bundler client, waiting for the receipt", async () => {
    const account = await KernelAccount.from({ client, owner: newOwner(), sessions: false })
    await devnet.fund(account.address)
    await devnet.sendUserOperation(account, [{ to: zeroAddress }])

    const receipt = await SmartAccount.installSessionsSync(devnet.bundlerClient(account, { bundleOnReceipt: true }))

    assert.strictEqual(receipt.status, "success")
    assert.isTrue(await SmartAccount.isSessionsInstalled(client, { address: account.address }))
  })
})
