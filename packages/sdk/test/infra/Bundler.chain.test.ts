import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { Bundler, BundlerError, KernelAccount, NameraError } from "@namera-ai/sdk"
import { zeroAddress } from "viem"
import { createBundlerClient } from "viem/account-abstraction"

import { client, devnet, newOwner } from "../accounts/accounts.test-utils.ts"
import { deployedAccount } from "../session.test-utils.ts"

describe("Bundler.from", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("sends through any bundler with the node's fees", async () => {
    const account = await deployedAccount()
    const bundler = createBundlerClient({
      account,
      client,
      pollingInterval: 50,
      ...Bundler.from({ url: devnet.bundlerUrl })
    })

    const hash = await bundler.sendUserOperation({ calls: [{ to: zeroAddress }] })
    await devnet.sendBundleNow()

    assert.isTrue((await bundler.waitForUserOperationReceipt({ hash })).success)
  })

  it("decodes the bundler's refusal of an account that can't pay", async () => {
    const account = await KernelAccount.from({ client, owner: newOwner(), sessions: false })
    const bundler = createBundlerClient({ account, client, ...Bundler.from({ url: devnet.bundlerUrl }) })

    const failure = await bundler.sendUserOperation({ calls: [{ to: zeroAddress }] }).then(
      () => assert.fail("expected a refusal"),
      (cause: unknown) => cause
    )
    const error = NameraError.decode(failure)

    assert.isTrue(BundlerError.isBundlerError(error))
    assert.deepInclude((error as BundlerError.BundlerError).reason, { _tag: "Rejected", aa: "AA21" })
  })
})
