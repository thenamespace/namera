import { afterEach, assert, beforeEach, describe, inject, it } from "@effect/vitest"
import { Devnet } from "@namera-ai/devnet"
import { Grant, GrantError, Policy, PolicyViolationError, Session, SessionKey } from "@namera-ai/sdk"
import { encodeFunctionData, type Hex, parseAbi } from "viem"
import type { SmartAccount } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

import { client, devnet, newOwner } from "./accounts/accounts.test-utils.ts"
import { type AccountType, deployedAccount, refusal } from "./session.test-utils.ts"

// A grant after it was made, on the devnet (safe-mode alto): the owner revokes and updates it with owner operations,
// and its status, limits and history are read without a key.

const token = privateKeyToAccount(generatePrivateKey()).address
const recipient = privateKeyToAccount(generatePrivateKey()).address
const payee = privateKeyToAccount(generatePrivateKey()).address
const erc20 = parseAbi(["function transfer(address to, uint256 amount)"])
const transfer = (amount: bigint) => ({
  to: token,
  data: encodeFunctionData({ abi: erc20, functionName: "transfer", args: [recipient, amount] })
})
const pay = (value: bigint) => ({ to: payee, value, data: "0x" as Hex })

const transfers = Policy.erc20Transfer({ token, to: [recipient], amount: { lte: 100n } })
const payments = Policy.nativeTransfer({ to: [payee], value: { lte: 1000n } })

/** Sends calls from an account through viem's bundler client on `on` and waits for the receipt. */
const send = async (
  agent: SmartAccount,
  calls: ReadonlyArray<{ readonly to: Hex; readonly data: Hex; readonly value?: bigint }>,
  on: Devnet.Devnet = devnet
) => {
  const bundler = on.bundlerClient(agent)
  const hash = await bundler.sendUserOperation({ calls: [...calls] })
  await on.sendBundleNow()
  return bundler.waitForUserOperationReceipt({ hash })
}

const violationOf = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected a PolicyViolationError"),
    (error: unknown) => {
      assert.isTrue(PolicyViolationError.isPolicyViolationError(error), String(error))
      return (error as PolicyViolationError.PolicyViolationError).reason._tag
    }
  )

// Every session needs a gas limit (Session.validate): the agent sets each operation's fees.
const gasLimit = Policy.gas({ maxCost: 10n ** 18n, period: "lifetime" })

const setUp = async (
  type: AccountType,
  policies: ReadonlyArray<Policy.Policy>,
  options: { readonly validUntil?: number } = {}
) => {
  const sessionKey = privateKeyToAccount(generatePrivateKey())
  const account = await deployedAccount(type)
  const session = Session.from({
    signer: SessionKey.ecdsa(sessionKey.address),
    validUntil: options.validUntil ?? Session.now() + 30 * 86400,
    policies: [...policies, gasLimit]
  })
  const grant = await Grant.create({ account, session })
  const owner = devnet.bundlerClient(account, { bundleOnReceipt: true })
  const agentOf = (current: Grant.Grant, check = true) =>
    Grant.toAccount(client, { grant: current, signer: sessionKey, check })
  return { account, grant, owner, sessionKey, agentOf }
}

describe.each(["kernel", "nexus", "safe7579"] as const)("a grant's lifecycle on a %s account", { concurrent: false }, (
  type: AccountType
) => {
  devnet.isolate({ beforeEach, afterEach })

  it("is revoked once used: its agent is refused, and revoking again sends nothing", async () => {
    const { agentOf, grant, owner } = await setUp(type, [transfers])
    assert.isTrue((await send(await agentOf(grant), [transfer(1n)])).success)

    assert.strictEqual((await Grant.revokeSync(owner, { grant }))?.status, "success")
    assert.strictEqual((await Grant.getStatus(client, { grant })).state, "revoked")
    assert.strictEqual(await violationOf(send(await agentOf(grant), [transfer(1n)])), "SessionRevoked")
    assert.match(await refusal(send(await agentOf(grant, false), [transfer(1n)])), /AA2|validateUserOp/)
    assert.isUndefined(await Grant.revoke(owner, { grant }))
  })

  it("is revoked unused: its first operation can't enable the session", async () => {
    const { agentOf, grant, owner } = await setUp(type, [transfers])
    assert.strictEqual((await Grant.getStatus(client, { grant })).state, "pending-enable")

    assert.isDefined(await Grant.revokeSync(owner, { grant }))
    assert.strictEqual((await Grant.getStatus(client, { grant })).state, "revoked")
    assert.strictEqual(await violationOf(send(await agentOf(grant), [transfer(1n)])), "SessionRevoked")
    assert.match(await refusal(send(await agentOf(grant, false), [transfer(1n)])), /AA2|validateUserOp/)
  })

  it("is updated in place: a removed call, a stricter limit and a wider condition take effect", async () => {
    const { agentOf, grant, owner } = await setUp(type, [transfers, payments])
    assert.isTrue((await send(await agentOf(grant), [transfer(1n)])).success)

    const { grant: updated } = await Grant.updateSync(owner, {
      grant,
      remove: [transfers, payments],
      add: [
        Policy.erc20Transfer({ token, to: [recipient], amount: { lte: 1000n } }),
        Policy.spend({ token, amount: 600n, period: "day" })
      ]
    })
    assert.strictEqual(updated.id, grant.id)
    // Still a grant: it parses and verifies (installed, so checked as enabled).
    assert.deepStrictEqual(Grant.parse(Grant.serialize(updated)), updated)
    await Grant.verify(client, updated)

    const agent = await agentOf(updated)
    assert.strictEqual(await violationOf(send(agent, [pay(1n)])), "CallNotAllowed")
    assert.strictEqual(await violationOf(send(agent, [transfer(601n)])), "SpendLimitExceeded")
    assert.isTrue((await send(agent, [transfer(500n)])).success)
  })
})

describe("a grant's lifecycle", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("updates an unused grant, so the old grant can't enable the old policies", async () => {
    const { agentOf, grant, owner } = await setUp("nexus", [transfers, payments])
    const { grant: updated } = await Grant.updateSync(owner, { grant, remove: [payments] })

    // The old grant's enable signature is spent; the updated grant's agent uses the session as updated.
    assert.match(await refusal(send(await agentOf(grant, false), [pay(1n)])), /AA2|validateUserOp/)
    assert.strictEqual(await violationOf(send(await agentOf(updated), [pay(1n)])), "CallNotAllowed")
    assert.isTrue((await send(await agentOf(updated), [transfer(1n)])).success)
  })

  it("refuses to remove a policy the session doesn't have, or to make an invalid session", async () => {
    const { grant, owner } = await setUp("kernel", [transfers])
    const reasonOf = (promise: Promise<unknown>) =>
      promise.then(() => assert.fail("expected a refusal"), (error: unknown) => error)

    const missing = await reasonOf(Grant.update(owner, { grant, remove: [payments] }))
    assert.isTrue(GrantError.isGrantError(missing))
    assert.strictEqual((missing as GrantError.GrantError).reason._tag, "PolicyNotFound")
    assert.throws(() => Grant.updateCalls(grant, { remove: [payments] }))
    assert.include(String(await reasonOf(Grant.update(owner, { grant, remove: [transfers] }))), "NO_CALL_POLICY")
  })

  it("reports its state over time, and its limits as they fill and reset", async () => {
    const validUntil = Number((await client.getBlock()).timestamp) + 2 * 86400
    const { agentOf, grant } = await setUp("safe7579", [
      transfers,
      Policy.spend({ token, amount: 150n, period: "day" })
    ], {
      validUntil
    })
    assert.strictEqual((await Grant.getStatus(client, { grant })).state, "pending-enable")
    assert.isFalse(await Grant.isEnabled(client, { grant }))

    assert.isTrue((await send(await agentOf(grant), [transfer(100n)])).success)
    const active = await Grant.getStatus(client, { grant })
    assert.strictEqual(active.state, "active")
    assert.deepInclude(active.limits[0], { kind: "spend", budget: 150n, used: 100n, remaining: 50n, period: 86400 })
    assert.deepStrictEqual(await Grant.getRemainingLimit(client, { grant, token }), {
      remaining: 50n,
      resetsAt: active.limits[0]!.resetsAt!
    })
    assert.isUndefined(await Grant.getRemainingLimit(client, { grant }))

    // The next day the budget is whole again; after the window the grant has expired.
    await devnet.setTime(active.limits[0]!.resetsAt!)
    await devnet.mine()
    assert.deepInclude((await Grant.getStatus(client, { grant })).limits[0], { used: 0n, remaining: 150n })
    await devnet.setTime(validUntil + 1)
    await devnet.mine()
    assert.strictEqual((await Grant.getStatus(client, { grant })).state, "expired")
  })

  it("lists the operations sent under it, and the sessions enabled on its account", async () => {
    const { account, agentOf, grant, owner, sessionKey } = await setUp("kernel", [transfers])
    const fromBlock = await client.getBlockNumber()
    const first = await send(await agentOf(grant), [transfer(1n)])
    const second = await send(await Grant.toAccount(client, { grant, signer: sessionKey, lane: 3 }), [transfer(2n)])
    // The account's other operations aren't the grant's: an owner operation enabling another session.
    await Grant.installSync(owner, { session: Session.from({ ...grant.session, salt: `0x${"77".repeat(32)}` }) })

    const usage = await Grant.getUsage(client, { grant, fromBlock, pageSize: 2n })
    assert.deepStrictEqual(usage.map((entry) => [entry.userOpHash, entry.mode, entry.lane, entry.success]), [
      [first.userOpHash, "enable", 0, true],
      [second.userOpHash, "use", 3, true]
    ])
    const listed = await Grant.list(client, { account: account.address, grants: [grant] })
    assert.strictEqual(listed.length, 2)
    assert.deepInclude(listed.find((entry) => entry.id === grant.id), { foreign: false, grant })
    assert.isTrue(listed.find((entry) => entry.id !== grant.id)!.foreign)
  })

  it("is revoked on every chain it covers", async () => {
    const second = await Devnet.from(inject(Devnet.contextKey), { chain: "second" })
    const id = await second.snapshot()
    try {
      const owner = newOwner()
      const first = await deployedAccount("safe7579", { owner })
      const other = await deployedAccount("safe7579", { owner, on: second })
      const sessionKey = privateKeyToAccount(generatePrivateKey())
      const session = Session.from({
        signer: SessionKey.ecdsa(sessionKey.address),
        validUntil: Session.now() + 86400,
        policies: [transfers, gasLimit]
      })
      const grant = await Grant.create({ account: [first, other], session })
      assert.isTrue((await send(await Grant.toAccount(client, { grant, signer: sessionKey }), [transfer(1n)])).success)

      // Enabled on the first chain (removed), unused on the second (its enable signature revoked).
      const receipts = await Grant.revokeSync(
        [
          devnet.bundlerClient(first, { bundleOnReceipt: true }),
          second.bundlerClient(other, { bundleOnReceipt: true })
        ],
        { grant }
      )
      assert.deepStrictEqual(receipts.map((receipt) => receipt?.status), ["success", "success"])
      const status = await Grant.getStatus([client, second.client], { grant })
      assert.deepStrictEqual(status.chains.map((chain) => chain.state), ["revoked", "revoked"])
      assert.strictEqual(status.state, "revoked")
    } finally {
      await second.revert(id)
    }
  })

  it("is watched: each change is reported once, until the watch is turned off", async () => {
    const { agentOf, grant, owner } = await setUp("nexus", [transfers, Policy.rateLimit({ count: 9, period: "day" })])
    const states: Array<string> = []
    const waiters: Array<{ readonly count: number; readonly resolve: () => void }> = []
    const watcher = Grant.watchStatus(client, {
      grant,
      pollingInterval: 50,
      onChange: (status) => {
        states.push(`${status.state}:${status.limits[0]?.used}`)
        for (const waiter of waiters.filter((entry) => states.length >= entry.count)) waiter.resolve()
      }
    })
    const changes = (count: number) =>
      states.length >= count ? Promise.resolve() : new Promise<void>((resolve) => waiters.push({ count, resolve }))

    await changes(1)
    assert.isTrue((await send(await agentOf(grant), [transfer(1n)])).success)
    await changes(2)
    await Grant.revokeSync(owner, { grant })
    await changes(3)
    watcher.off()
    // A revoked session's counters stay: usage is kept by configuration, not by enablement.
    assert.deepStrictEqual(states, ["pending-enable:0", "active:1", "revoked:1"])

    await devnet.mine()
    await Grant.getStatus(client, { grant })
    assert.strictEqual(states.length, 3)
  })
})
