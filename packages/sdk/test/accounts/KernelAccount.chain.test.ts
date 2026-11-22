import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { External, SmartSession } from "@namera-ai/contracts"
import { Account, KernelAccount } from "@namera-ai/sdk"
import { toKernelSmartAccount } from "permissionless/accounts"
import { parseAbi, parseEther, zeroAddress } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"

import { client, devnet, newOwner, sameBytes } from "./accounts.test-utils.ts"

const kernel = External.kernel["3.3"]
const typedData = {
  domain: { name: "Example", version: "1", chainId: devnet.chain.id, verifyingContract: zeroAddress },
  types: { Mail: [{ name: "contents", type: "string" }] },
  primaryType: "Mail",
  message: { contents: "hello" }
} as const

describe("KernelAccount", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  describe("matches permissionless's Kernel 3.3 byte for byte", () => {
    const pair = async () => {
      const owner = newOwner()
      const ours = await KernelAccount.from({ client, owner, sessions: false })
      const reference = await toKernelSmartAccount({
        client,
        owners: [owner],
        version: "0.3.3",
        entryPoint: { address: entryPoint07Address, version: "0.7" }
      })
      return { ours, reference }
    }

    it("address, factory, nonce and call encoding", async () => {
      const { ours, reference } = await pair()
      const calls = [{ to: zeroAddress, value: 1n }, { to: SmartSession.v1.address, data: "0x1234" as const }]

      assert.strictEqual(ours.address, reference.address)
      const [factory, referenceFactory] = [await ours.getFactoryArgs(), await reference.getFactoryArgs()]
      assert.strictEqual(factory.factory, referenceFactory.factory)
      assert.isTrue(sameBytes(factory.factoryData, referenceFactory.factoryData))
      assert.strictEqual(await ours.getNonce(), await reference.getNonce())
      assert.isTrue(sameBytes(await ours.encodeCalls([calls[0]!]), await reference.encodeCalls([calls[0]!])))
      assert.isTrue(sameBytes(await ours.encodeCalls(calls), await reference.encodeCalls(calls)))
      assert.strictEqual(await ours.getStubSignature(), await reference.getStubSignature())
    })

    it("user operation, message and typed data signatures", async () => {
      const { ours, reference } = await pair()
      const operation = {
        sender: ours.address,
        nonce: 0n,
        callData: "0x" as const,
        callGasLimit: 1n,
        verificationGasLimit: 1n,
        preVerificationGas: 1n,
        maxFeePerGas: 1n,
        maxPriorityFeePerGas: 1n,
        signature: "0x" as const
      }

      assert.strictEqual(await ours.signUserOperation(operation), await reference.signUserOperation(operation))
      assert.isTrue(
        sameBytes(await ours.signMessage({ message: "hello" }), await reference.signMessage({ message: "hello" }))
      )
      assert.isTrue(sameBytes(await ours.signTypedData(typedData), await reference.signTypedData(typedData)))
    })
  })

  it("deploys through the staked FactoryStaker to the address the factory computes, offline", async () => {
    const owner = newOwner()
    const account = await KernelAccount.from({ client, owner, index: 7n })
    const { factory, factoryData } = await account.getFactoryArgs()

    assert.strictEqual(factory, kernel.factoryStaker)
    const [forwardedTo, data, salt] = (await import("viem")).decodeFunctionData({
      abi: parseAbi(["function deployWithFactory(address factory, bytes createData, bytes32 salt)"]),
      data: factoryData!
    }).args
    assert.strictEqual(forwardedTo, kernel.factory)
    const predicted = await client.readContract({
      address: kernel.factory,
      abi: parseAbi(["function getAddress(bytes data, bytes32 salt) view returns (address)"]),
      functionName: "getAddress",
      args: [data, salt]
    })
    assert.strictEqual(account.address, predicted)
    assert.deepStrictEqual(account.namera, { type: "kernel", version: "3.3", entryPoint: "0.7", eip7702: false })
  })

  it("deploys with Smart Sessions in its first operation, then transfers and batches", async () => {
    const account = await KernelAccount.from({ client, owner: newOwner() })
    await devnet.fund(account.address)

    assert.isTrue((await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }])).success)
    assert.isTrue(await Account.isSessionsInstalled(client, { address: account.address }))

    const recipient = newOwner().address
    const batch = await devnet.sendUserOperation(account, [{ to: recipient, value: 2n }, { to: recipient, value: 3n }])
    assert.isTrue(batch.success)
    assert.strictEqual(await client.getBalance({ address: recipient }), 5n)
  })

  it("signs ERC-1271 messages and typed data that viem verifies, before and after deployment", async () => {
    const account = await KernelAccount.from({ client, owner: newOwner() })
    await devnet.fund(account.address)

    const verify = async () => {
      assert.isTrue(
        await client.verifyMessage({
          address: account.address,
          message: "hello",
          signature: await account.signMessage({ message: "hello" })
        })
      )
      assert.isTrue(
        await client.verifyTypedData({
          address: account.address,
          ...typedData,
          signature: await account.signTypedData(typedData)
        })
      )
    }
    await verify()
    await devnet.sendUserOperation(account, [{ to: zeroAddress }])
    await verify()
  })

  it("installs Smart Sessions later on an account deployed without them", async () => {
    const account = await KernelAccount.from({ client, owner: newOwner(), sessions: false })
    await devnet.fund(account.address)
    await devnet.sendUserOperation(account, [{ to: zeroAddress }])
    assert.isFalse(await Account.isSessionsInstalled(client, { address: account.address }))

    assert.isTrue((await devnet.sendUserOperation(account, Account.installSessionsCalls(account))).success)
    assert.isTrue(await Account.isSessionsInstalled(client, { address: account.address }))
  })

  it("delegates the owner's address through EIP-7702 in the first operation, with Smart Sessions", async () => {
    const owner = newOwner()
    const account = await KernelAccount.fromEip7702({ client, owner })
    await devnet.fund(owner.address)
    assert.strictEqual(account.address, owner.address)

    assert.isTrue((await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }])).success)
    assert.strictEqual(
      await client.getCode({ address: owner.address }),
      `0xef0100${kernel.implementation.slice(2).toLowerCase()}`
    )
    assert.isTrue(await Account.isSessionsInstalled(client, { address: owner.address }))

    const recipient = newOwner().address
    assert.isTrue(
      (await devnet.sendUserOperation(account, [{ to: recipient, value: parseEther("0.1") }, {
        to: recipient,
        value: 1n
      }])).success
    )
    assert.isTrue(
      await client.verifyTypedData({
        address: account.address,
        ...typedData,
        signature: await account.signTypedData(typedData)
      })
    )
  })
})
