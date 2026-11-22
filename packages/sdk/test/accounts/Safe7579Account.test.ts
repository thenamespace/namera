import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { External } from "@namera-ai/contracts"
import { Account, AccountError, Safe7579Account } from "@namera-ai/sdk"
import {
  concat,
  decodeFunctionData,
  encodeAbiParameters,
  getContractAddress,
  keccak256,
  parseAbi,
  toHex,
  zeroAddress
} from "viem"

import { chain, client, fund, isolate, newOwner, send } from "./accounts.test-utils.ts"

const safe = External.safe7579["2"]
const typedData = {
  domain: { name: "Example", version: "1", chainId: chain.chain.id, verifyingContract: zeroAddress },
  types: { Mail: [{ name: "contents", type: "string" }] },
  primaryType: "Mail",
  message: { contents: "hello" }
} as const

const verify = async (account: Safe7579Account.Safe7579Account) => {
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

describe("Safe7579Account", { concurrent: false }, () => {
  isolate({ beforeEach, afterEach })

  it("computes the address from the proxy factory's creation code, offline", async () => {
    const account = await Safe7579Account.from({ client, owners: [newOwner()], index: 5n })
    const { factoryData } = await account.getFactoryArgs()
    const [singleton, initializer, saltNonce] = decodeFunctionData({
      abi: parseAbi(["function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce)"]),
      data: factoryData!
    }).args
    const creationCode = await client.readContract({
      address: safe.proxyFactory,
      abi: parseAbi(["function proxyCreationCode() view returns (bytes)"]),
      functionName: "proxyCreationCode"
    })

    assert.strictEqual(
      account.address,
      getContractAddress({
        opcode: "CREATE2",
        from: safe.proxyFactory,
        salt: keccak256(concat([keccak256(initializer), toHex(saltNonce, { size: 32 })])),
        bytecode: concat([creationCode, encodeAbiParameters([{ type: "address" }], [singleton])])
      })
    )
  })

  it("deploys with Smart Sessions in its first operation, then transfers and batches", async () => {
    const account = await Safe7579Account.from({ client, owners: [newOwner()] })
    await fund(account.address)

    assert.isTrue((await send(account, [{ to: zeroAddress, value: 1n }])).success)
    assert.isTrue(await Account.isSessionsInstalled(client, { address: account.address }))

    const recipient = newOwner().address
    assert.isTrue((await send(account, [{ to: recipient, value: 2n }, { to: recipient, value: 3n }])).success)
    assert.strictEqual(await client.getBalance({ address: recipient }), 5n)
    assert.deepStrictEqual(account.namera, { type: "safe7579", version: "2", entryPoint: "0.7", eip7702: false })
  })

  it("puts the same owners at the same address, whatever order they are given in", async () => {
    const owners = [newOwner(), newOwner(), newOwner()]
    const addresses = await Promise.all(
      [owners, [...owners].reverse(), [owners[1]!, owners[0]!, owners[2]!]].map(async (order) =>
        (await Safe7579Account.from({ client, owners: order, threshold: 2 })).address
      )
    )
    assert.strictEqual(new Set(addresses).size, 1)
  })

  it("needs every owner's signature at a two-of-two threshold", async () => {
    const owners = [newOwner(), newOwner()]
    const account = await Safe7579Account.from({ client, owners, threshold: 2 })
    await fund(account.address)

    assert.isTrue((await send(account, [{ to: zeroAddress, value: 1n }])).success)
    await verify(account)

    const oneOwner = await Safe7579Account.from({
      client,
      owners: [owners[0]!],
      threshold: 1,
      address: account.address
    })
    const signature = await oneOwner.signTypedData(typedData)
    assert.isFalse(await client.verifyTypedData({ address: account.address, ...typedData, signature }))
  })

  it("signs ERC-1271 messages and typed data that viem verifies, before and after deployment", async () => {
    const account = await Safe7579Account.from({ client, owners: [newOwner()] })
    await fund(account.address)

    await verify(account)
    await send(account, [{ to: zeroAddress }])
    await verify(account)
  })

  it("installs Smart Sessions later on an account deployed without them", async () => {
    const account = await Safe7579Account.from({ client, owners: [newOwner()], sessions: false })
    await fund(account.address)
    await send(account, [{ to: zeroAddress }])
    assert.isFalse(await Account.isSessionsInstalled(client, { address: account.address }))

    assert.isTrue((await send(account, Account.installSessionsCalls(account))).success)
    assert.isTrue(await Account.isSessionsInstalled(client, { address: account.address }))
  })

  it("rejects repeated owners and a threshold outside 1 to the number of owners", async () => {
    const owner = newOwner()
    for (
      const options of [{ owners: [owner, owner] }, { owners: [owner], threshold: 2 }, {
        owners: [owner],
        threshold: 0
      }]
    ) {
      const error = await Safe7579Account.from({ client, ...options }).then(
        () => assert.fail("expected AccountError"),
        (error: unknown) => error
      )
      assert.isTrue(AccountError.isAccountError(error))
      assert.strictEqual((error as AccountError.AccountError).reason._tag, "InvalidOptions")
    }
  })
})
