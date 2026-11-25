import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { Grant, Policy, Session, SessionKey, SmartAccount } from "@namera-ai/sdk"
import { nameraActions } from "@namera-ai/sdk/decorators"
import { http, zeroAddress } from "viem"
import { createBundlerClient } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

import { client, devnet } from "../accounts/accounts.test-utils.ts"
import { deployedAccount } from "../session.test-utils.ts"

// The decorator forwards to the standalone functions: the same values on success and the same errors on failure.

const recipient = privateKeyToAccount(generatePrivateKey()).address
const sessionKey = privateKeyToAccount(generatePrivateKey())
const session = Session.from({
  signer: SessionKey.ecdsa(sessionKey.address),
  validUntil: 2_000_000_000,
  salt: `0x${"33".repeat(32)}`,
  policies: [
    Policy.nativeTransfer({ to: [recipient], value: { lte: 1000n } }),
    Policy.gas({ maxCost: 10n ** 18n, period: "lifetime" })
  ]
})

const failureOf = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected the promise to reject"),
    (error: unknown) => {
      const { _tag, message, reason } = error as { _tag?: string; message?: string; reason?: { _tag?: string } }
      return { _tag, reason: reason?._tag, message }
    }
  )

/** Resolves with the first status a watch reports, then stops it. */
const firstStatus = (watch: (onChange: (status: Grant.getStatus.Status) => void) => Grant.watchStatus.Watcher) =>
  new Promise<Grant.getStatus.Status>((resolve) => {
    const watcher = watch((status) => {
      watcher.off()
      resolve(status)
    })
  })

describe("nameraActions", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("reads grants as the standalone functions do", async () => {
    const account = await deployedAccount()
    const decorated = client.extend(nameraActions())
    const grant = await decorated.namera.grant.create({ account, session })
    const { address } = account

    assert.deepStrictEqual(grant, await Grant.create({ account, session }))
    assert.deepStrictEqual(
      await decorated.namera.grant.prepare({ account, session }),
      await Grant.prepare({ account, session })
    )
    assert.isUndefined(await decorated.namera.grant.verify(grant))
    assert.deepStrictEqual(
      await decorated.namera.grant.getStatus({ grant }),
      await Grant.getStatus(client, { grant })
    )
    assert.strictEqual(
      await decorated.namera.grant.isEnabled({ grant }),
      await Grant.isEnabled(client, { grant })
    )
    assert.deepStrictEqual(
      await decorated.namera.grant.getRemainingLimit({ grant }),
      await Grant.getRemainingLimit(client, { grant })
    )
    assert.deepStrictEqual(
      await decorated.namera.grant.getUsage({ grant }),
      await Grant.getUsage(client, { grant })
    )
    assert.deepStrictEqual(
      await decorated.namera.grant.list({ account: address, grants: [grant] }),
      await Grant.list(client, { account: address, grants: [grant] })
    )
    const calls = [{ to: recipient, value: 1n, data: "0x" as const }]
    assert.deepStrictEqual(
      await decorated.namera.grant.check({ grant, calls }),
      await Grant.check(client, { grant, calls })
    )
    assert.strictEqual(
      (await decorated.namera.grant.toAccount({ grant, signer: sessionKey })).address,
      (await Grant.toAccount(client, { grant, signer: sessionKey })).address
    )
    assert.deepStrictEqual(
      await firstStatus((onChange) => decorated.namera.grant.watchStatus({ grant, onChange, pollingInterval: 50 })),
      await firstStatus((onChange) => Grant.watchStatus(client, { grant, onChange, pollingInterval: 50 }))
    )
  })

  it("reads accounts as the standalone functions do", async () => {
    const { address } = await deployedAccount()
    const decorated = client.extend(nameraActions())

    assert.deepStrictEqual(
      await decorated.namera.account.detect({ address }),
      await SmartAccount.detect(client, { address })
    )
    assert.strictEqual(
      await decorated.namera.account.isSessionsInstalled({ address }),
      await SmartAccount.isSessionsInstalled(client, { address })
    )
    assert.deepStrictEqual(
      await decorated.namera.account.getOwners({ address }),
      await SmartAccount.getOwners(client, { address })
    )
  })

  it("sends owner operations through the bundler client it decorates", async () => {
    const account = await deployedAccount()
    const grant = await Grant.create({ account, session })
    const owner = devnet.bundlerClient(account, { bundleOnReceipt: true }).extend(nameraActions())

    assert.strictEqual((await owner.namera.grant.revokeSync({ grant }))?.status, "success")
    assert.strictEqual((await Grant.getStatus(client, { grant })).state, "revoked")
    assert.isUndefined(await owner.namera.grant.revoke({ grant }))
  })

  it("fails as the standalone functions do", async () => {
    // A bundler client without an account: every owner operation refuses it before sending.
    const bundler = createBundlerClient({ client, transport: http(devnet.bundlerUrl) })
    const decorated = bundler.extend(nameraActions())
    const grant = await Grant.create({ account: await deployedAccount(), session })
    const owner = { owner: zeroAddress } as const

    const pairs: ReadonlyArray<readonly [Promise<unknown>, Promise<unknown>]> = [
      [decorated.namera.grant.install({ session }), Grant.install(bundler, { session })],
      [decorated.namera.grant.installSync({ session }), Grant.installSync(bundler, { session })],
      [decorated.namera.grant.revoke({ grant }), Grant.revoke(bundler, { grant })],
      [decorated.namera.grant.revokeSync({ grant }), Grant.revokeSync(bundler, { grant })],
      [decorated.namera.grant.update({ grant }), Grant.update(bundler, { grant })],
      [decorated.namera.grant.updateSync({ grant }), Grant.updateSync(bundler, { grant })],
      [decorated.namera.account.installSessions(), SmartAccount.installSessions(bundler)],
      [decorated.namera.account.installSessionsSync(), SmartAccount.installSessionsSync(bundler)],
      [decorated.namera.account.addOwner(owner), SmartAccount.addOwner(bundler, owner)],
      [decorated.namera.account.addOwnerSync(owner), SmartAccount.addOwnerSync(bundler, owner)],
      [decorated.namera.account.removeOwner(owner), SmartAccount.removeOwner(bundler, owner)],
      [decorated.namera.account.removeOwnerSync(owner), SmartAccount.removeOwnerSync(bundler, owner)],
      [decorated.namera.account.setThreshold({ threshold: 1 }), SmartAccount.setThreshold(bundler, { threshold: 1 })],
      [
        decorated.namera.account.setThresholdSync({ threshold: 1 }),
        SmartAccount.setThresholdSync(bundler, { threshold: 1 })
      ],
      [
        decorated.namera.account.replaceOwner({ owner: zeroAddress, with: recipient }),
        SmartAccount.replaceOwner(bundler, { owner: zeroAddress, with: recipient })
      ],
      [
        decorated.namera.account.replaceOwnerSync({ owner: zeroAddress, with: recipient }),
        SmartAccount.replaceOwnerSync(bundler, { owner: zeroAddress, with: recipient })
      ],
      [
        decorated.namera.account.addOwnerValidator({ owner: recipient }),
        SmartAccount.addOwnerValidator(bundler, { owner: recipient })
      ],
      [
        decorated.namera.account.addOwnerValidatorSync({ owner: recipient }),
        SmartAccount.addOwnerValidatorSync(bundler, { owner: recipient })
      ]
    ]

    for (const [viaDecorator, standalone] of pairs) {
      assert.deepStrictEqual(await failureOf(viaDecorator), await failureOf(standalone))
    }
  })
})
