import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { KernelAccount, NexusAccount, Safe7579Account, type SmartAccount } from "@namera-ai/sdk"
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

// Nexus and Safe7579 deploy through their factory first: a bundler that enforces ERC-7562 refuses to deploy them in a
// user operation (their factories are unstaked; see their own tests).
const builders: ReadonlyArray<readonly [string, () => Promise<SmartAccount.SmartAccount>, boolean]> = [
  ["Kernel", () => KernelAccount.from({ client, owner: walletOwner }), false],
  ["Nexus", () => NexusAccount.from({ client, owner: walletOwner }), true],
  ["Safe7579", () => Safe7579Account.from({ client, owners: [walletOwner] }), true]
]

describe("a JSON-RPC wallet owner", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  for (const [name, build, deployFirst] of builders) {
    it(`deploys and runs a ${name} account, and signs ERC-1271 typed data`, async () => {
      const account = await build()
      await devnet.fund(account.address)
      if (deployFirst) await devnet.deploy(account)

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
  }
})
