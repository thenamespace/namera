import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { External, SessionHook, SmartSession } from "@namera-ai/contracts"
import { AccountError, KernelAccount, NexusAccount, Safe7579Account, SmartAccount } from "@namera-ai/sdk"
import { toKernelSmartAccount } from "permissionless/accounts"
import { createWalletClient, encodeAbiParameters, encodeFunctionData, http, parseAbi, zeroAddress } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

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

  it("detects a Safe7579 account by its Safe singleton and the adapter's account id", async () => {
    const account = await Safe7579Account.from({ client, owners: [newOwner()] })
    await devnet.deploy(account)

    assert.deepInclude(await SmartAccount.detect(client, { address: account.address }), {
      type: "safe7579",
      version: "2",
      eip7702: false,
      sessionsInstalled: true
    })
  })

  it("detects EIP-7702 delegations and reports undeployed addresses", async () => {
    const owner = newOwner()
    const account = await NexusAccount.fromEip7702({ client, owner })
    await devnet.fund(owner.address)
    await devnet.sendUserOperation(account, [{ to: zeroAddress }])

    const detected = await SmartAccount.detect(client, { address: owner.address })
    assert.deepInclude(detected, { type: "nexus", version: "1.3.3", eip7702: true, sessionsInstalled: true })
    assert.deepStrictEqual(await SmartAccount.detect(client, { address: newOwner().address }), { type: "undeployed" })
  })

  it("rejects an account whose implementation it doesn't support, naming the implementation", async () => {
    // A plain Safe 1.4.1 without the Safe7579 adapter.
    const deployer = createWalletClient({
      account: privateKeyToAccount(devnet.keys[1]!),
      chain: devnet.chain,
      transport: http(devnet.rpcUrl)
    })
    const safe = External.safe7579["2"]
    const owner = newOwner()
    const initializer = encodeFunctionData({
      abi: parseAbi([
        "function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)"
      ]),
      functionName: "setup",
      args: [[owner.address], 1n, zeroAddress, "0x", zeroAddress, zeroAddress, 0n, zeroAddress]
    })
    const factory = {
      address: safe.proxyFactory,
      abi: parseAbi(["function createProxyWithNonce(address, bytes, uint256) returns (address)"])
    }
    const { result: address } = await client.simulateContract({
      ...factory,
      account: deployer.account,
      functionName: "createProxyWithNonce",
      args: [safe.singletonL2, initializer, 0n]
    })
    await client.waitForTransactionReceipt({
      hash: await deployer.writeContract({
        ...factory,
        functionName: "createProxyWithNonce",
        args: [safe.singletonL2, initializer, 0n]
      })
    })

    assert.deepStrictEqual(await SmartAccount.detect(client, { address }), {
      type: "unsupported",
      implementation: safe.singletonL2.toLowerCase() as `0x${string}`
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
    const [install, ...rest] = SmartAccount.installSessionsCalls(account)
    assert.strictEqual(install?.to, account.address)
    assert.include(install?.data ?? "", SmartSession.v1.address.slice(2).toLowerCase())
    assert.strictEqual(rest.length, 0)
  })

  it("refuses to install sessions next to another global hook on Nexus, before sending", async () => {
    const account = await NexusAccount.from({ client, owner: newOwner(), sessions: false })
    await devnet.fund(account.address)
    await devnet.deploy(account)
    // Another hook: SessionHook's own bytecode at a different address.
    const otherHook = privateKeyToAccount(generatePrivateKey()).address
    const code = await client.getCode({ address: SessionHook.v1.address })
    await client.request({ method: "anvil_setCode" as never, params: [otherHook, code] as never })
    const installHook = encodeFunctionData({
      abi: parseAbi(["function installModule(uint256 moduleTypeId, address module, bytes initData)"]),
      args: [4n, otherHook, encodeAbiParameters([{ type: "uint8" }, { type: "address" }], [2, SmartSession.v1.address])]
    })
    assert.isTrue((await devnet.sendUserOperation(account, [{ to: account.address, data: installHook }])).success)

    const error = await rejection(SmartAccount.installSessions(devnet.bundlerClient(account)))
    assert.isTrue(AccountError.isAccountError(error))
    const reason = (error as AccountError.AccountError).reason
    assert.strictEqual(reason._tag, "OperationNotSupported")
    assert.include(reason.message, otherHook)
    assert.isFalse(await SmartAccount.isSessionsInstalled(client, { address: account.address }))
  })
})
