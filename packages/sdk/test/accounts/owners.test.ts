import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { type Account, KernelAccount, NexusAccount, Safe7579Account } from "@namera-ai/sdk"
import { zeroAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"

import { chain, client, fund, isolate, send } from "./accounts.test-utils.ts"

// A JSON-RPC (EIP-1193) owner: anvil signs `personal_sign` and `eth_signTypedData_v4` for its unlocked development
// accounts, as a browser wallet would through the client.
const walletOwner = { type: "json-rpc", address: privateKeyToAccount(chain.keys[3]!).address } as const

const typedData = {
  domain: { name: "Example", version: "1", chainId: chain.chain.id, verifyingContract: zeroAddress },
  types: { Mail: [{ name: "contents", type: "string" }] },
  primaryType: "Mail",
  message: { contents: "hello" }
} as const

const builders: ReadonlyArray<readonly [string, () => Promise<Account.Account>]> = [
  ["Kernel", () => KernelAccount.from({ client, owner: walletOwner })],
  ["Nexus", () => NexusAccount.from({ client, owner: walletOwner })],
  ["Safe7579", () => Safe7579Account.from({ client, owners: [walletOwner] })]
]

describe("a JSON-RPC wallet owner", { concurrent: false }, () => {
  isolate({ beforeEach, afterEach })

  for (const [name, build] of builders) {
    it(`deploys and runs a ${name} account, and signs ERC-1271 typed data`, async () => {
      const account = await build()
      await fund(account.address)

      assert.isTrue((await send(account, [{ to: zeroAddress, value: 1n }])).success)
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
