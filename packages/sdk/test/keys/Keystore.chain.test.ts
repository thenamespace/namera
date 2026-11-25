import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { KernelAccount, Keystore } from "@namera-ai/sdk"
import { zeroAddress } from "viem"

import { client, devnet } from "../accounts/accounts.test-utils.ts"

describe("a Keystore key as an account owner", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("owns a Kernel account that deploys and runs a user operation through alto", async () => {
    const store = Keystore.encryptedJson({ password: "agent", kdf: { type: "scrypt", n: 1024 } })
    const key = await Keystore.create(store, { curve: "secp256k1" })
    const owner = await Keystore.toAccount(store, { id: key.id })
    const account = await KernelAccount.from({ client, owner })
    await devnet.fund(account.address)

    assert.isTrue((await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }])).success)
    assert.isTrue(
      await client.verifyMessage({
        address: account.address,
        message: "hello",
        signature: await account.signMessage({ message: "hello" })
      })
    )
  })
})
