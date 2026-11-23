import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { External } from "@namera-ai/contracts"
import { ChainError, NexusAccount, SmartAccount } from "@namera-ai/sdk"
import { decodeFunctionData, parseAbi, zeroAddress, zeroHash } from "viem"

import { client, devnet, newOwner } from "./accounts.test-utils.ts"

const nexus = External.nexus["1.3.3"]
const typedData = {
  domain: { name: "Example", version: "1", chainId: devnet.chain.id, verifyingContract: zeroAddress },
  types: { Mail: [{ name: "contents", type: "string" }] },
  primaryType: "Mail",
  message: { contents: "hello" }
} as const

const verify = async (account: NexusAccount.NexusAccount) => {
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

describe("NexusAccount", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("computes the address the factory deploys to, offline", async () => {
    for (const sessions of [true, false]) {
      const account = await NexusAccount.from({ client, owner: newOwner(), index: 3n, sessions })
      const { factoryData } = await account.getFactoryArgs()
      const [initData, salt] = decodeFunctionData({
        abi: parseAbi(["function createAccount(bytes initData, bytes32 salt)"]),
        data: factoryData!
      }).args
      const predicted = await client.readContract({
        address: nexus.factory,
        abi: parseAbi(["function computeAccountAddress(bytes initData, bytes32 salt) view returns (address)"]),
        functionName: "computeAccountAddress",
        args: [initData, salt]
      })
      assert.strictEqual(account.address, predicted)
    }
  })

  // The factory has no EntryPoint stake on any chain, and initialising the K1 validator writes its storage for the
  // account, which ERC-7562 (STO-022) allows during deployment only under a staked factory. Lenient bundlers accept it.
  it("can't deploy in a user operation on a bundler that enforces ERC-7562: its factory is unstaked", async () => {
    const account = await NexusAccount.from({ client, owner: newOwner() })
    await devnet.fund(account.address)

    const error = await devnet.sendUserOperation(account, [{ to: zeroAddress }]).then(
      () => assert.fail("expected the bundler to reject it"),
      (error: unknown) => error
    )
    assert.include(String(error), `unstaked factory accessed ${nexus.k1Validator.toLowerCase()}`)

    // Sent through Namera, the error says what to do about it.
    const fresh = await NexusAccount.from({ client, owner: newOwner(), sessions: false })
    await devnet.fund(fresh.address)
    const namera = await SmartAccount.installSessions(devnet.bundlerClient(fresh)).then(
      () => assert.fail("expected the bundler to reject it"),
      (error: unknown) => error
    )
    assert.isTrue(ChainError.isChainError(namera))
    assert.include((namera as ChainError.ChainError).reason.hint, "hosted bundler")
  })

  it("deploys with Smart Sessions through its factory, then transfers and batches", async () => {
    const account = await NexusAccount.from({ client, owner: newOwner() })
    await devnet.fund(account.address)
    await devnet.deploy(account)
    assert.isTrue(await SmartAccount.isSessionsInstalled(client, { address: account.address }))

    assert.isTrue((await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }])).success)

    const recipient = newOwner().address
    assert.isTrue(
      (await devnet.sendUserOperation(account, [{ to: recipient, value: 2n }, { to: recipient, value: 3n }])).success
    )
    assert.strictEqual(await client.getBalance({ address: recipient }), 5n)
    assert.deepStrictEqual(account.namera, { type: "nexus", version: "1.3.3", entryPoint: "0.7", eip7702: false })
  })

  it("signs in the domain the deployed account reports (1.3.3 reports version 1.3.2)", async () => {
    const account = await NexusAccount.from({ client, owner: newOwner() })
    await devnet.deploy(account)

    const [, name, version, chainId, verifyingContract, salt] = await client.readContract({
      address: account.address,
      abi: parseAbi([
        "function eip712Domain() view returns (bytes1, string, string, uint256, address, bytes32, uint256[])"
      ]),
      functionName: "eip712Domain"
    })
    assert.deepStrictEqual([name, version, chainId, verifyingContract, salt], [
      "Nexus",
      "1.3.2",
      BigInt(devnet.chain.id),
      account.address,
      zeroHash
    ])
  })

  it("signs ERC-1271 messages and typed data that viem verifies, before and after deployment", async () => {
    const account = await NexusAccount.from({ client, owner: newOwner() })
    await devnet.fund(account.address)

    await verify(account)
    await devnet.deploy(account)
    await verify(account)
  })

  it("installs Smart Sessions later on an account deployed without them", async () => {
    const account = await NexusAccount.from({ client, owner: newOwner(), sessions: false })
    await devnet.fund(account.address)
    await devnet.deploy(account)
    assert.isFalse(await SmartAccount.isSessionsInstalled(client, { address: account.address }))

    assert.isTrue((await devnet.sendUserOperation(account, SmartAccount.installSessionsCalls(account))).success)
    assert.isTrue(await SmartAccount.isSessionsInstalled(client, { address: account.address }))
  })

  it("delegates the owner's address through EIP-7702 in the first operation, with Smart Sessions", async () => {
    const owner = newOwner()
    const account = await NexusAccount.fromEip7702({ client, owner })
    await devnet.fund(owner.address)

    assert.isTrue((await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }])).success)
    assert.strictEqual(
      await client.getCode({ address: owner.address }),
      `0xef0100${nexus.implementation.slice(2).toLowerCase()}`
    )
    assert.isTrue(await SmartAccount.isSessionsInstalled(client, { address: owner.address }))
    assert.isTrue(
      (await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }, { to: zeroAddress, value: 2n }]))
        .success
    )
    await verify(account)
  })
})
