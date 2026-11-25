import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { KernelAccount } from "@namera-ai/sdk"
import { zeroAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"

import { client, devnet } from "./accounts.test-utils.ts"

// A JSON-RPC (EIP-1193) owner: anvil signs `personal_sign` and `eth_signTypedData_v4` for its unlocked development
// accounts, as a browser wallet would through the client.
const walletOwner = { type: "json-rpc", address: privateKeyToAccount(devnet.keys[3]!).address } as const

const typedData = {
  domain: { name: "Example", version: "1", chainId: devnet.chain.id, verifyingContract: zeroAddress },
  types: { Mail: [{ name: "contents", type: "string" }] },
  primaryType: "Mail",
  message: { contents: "hello" }
} as const

describe("a JSON-RPC wallet owner", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("deploys and runs a Kernel account, and signs ERC-1271 typed data", async () => {
    const account = await KernelAccount.from({ client, owner: walletOwner })
    await devnet.fund(account.address)

    assert.isTrue((await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }])).success)
    assert.isTrue(
      await client.verifyTypedData({
        address: account.address,
        ...typedData,
        signature: await account.signTypedData(typedData)
      })
    )
    assert.isTrue(
      await client.verifyMessage({
        address: account.address,
        message: "hi",
        signature: await account.signMessage({ message: "hi" })
      })
    )
  })
})
