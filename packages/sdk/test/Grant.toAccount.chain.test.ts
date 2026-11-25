import { afterEach, assert, beforeEach, describe, inject, it } from "@effect/vitest"
import { External } from "@namera-ai/contracts"
import { Devnet } from "@namera-ai/devnet"
import { Grant, GrantError, Policy, PolicyViolationError, Session, SessionKey } from "@namera-ai/sdk"
import { encodeFunctionData, hashTypedData, type Hex, parseAbi } from "viem"
import type { SmartAccount } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

import { client, devnet } from "./accounts/accounts.test-utils.ts"
import { newPasskey } from "./accounts/passkey.test-utils.ts"
import { deployedAccount, refusal } from "./session.test-utils.ts"

// The agent's account on the devnet (safe-mode alto), driven only by viem's bundler client: the first operation
// enables the session (ENABLE mode) and deploys an undeployed account, later ones use it, lanes send in parallel,
// and session signatures verify through the account. With `check`, policy violations are refused before signing.

const token = privateKeyToAccount(generatePrivateKey()).address
const recipient = privateKeyToAccount(generatePrivateKey()).address
const stranger = privateKeyToAccount(generatePrivateKey()).address
const erc20 = parseAbi(["function transfer(address to, uint256 amount)"])
const erc1271 = parseAbi(["function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)"])
const transferTo = (to: Hex, amount: bigint) => ({
  to: token,
  data: encodeFunctionData({ abi: erc20, functionName: "transfer", args: [to, amount] })
})
const transfer = (amount: bigint) => transferTo(recipient, amount)

const permit = (value: bigint) => ({
  domain: { name: "Token", version: "1", chainId: devnet.chain.id, verifyingContract: token },
  types: { Permit: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }] },
  primaryType: "Permit" as const,
  message: { spender: recipient, value }
})

const addressOf = (grant: Grant.Grant) => grant.account.split(":")[2] as Hex

const isEnabled = (grant: Grant.Grant) =>
  client.readContract({
    address: grant.chains[0]!.contracts.smartSession,
    abi: parseAbi(["function isPermissionEnabled(bytes32, address) view returns (bool)"]),
    functionName: "isPermissionEnabled",
    args: [grant.id, addressOf(grant)]
  })

/** Sends calls from the agent through viem's bundler client and waits for the receipt. */
const send = async (agent: SmartAccount, calls: ReadonlyArray<{ readonly to: Hex; readonly data: Hex }>) => {
  const bundler = devnet.bundlerClient(agent)
  const hash = await bundler.sendUserOperation({ calls: [...calls] })
  await devnet.sendBundleNow()
  return bundler.waitForUserOperationReceipt({ hash })
}

/** What the verifying contract (the token) hears from the account when it checks a signature of `typedData`. */
const verifiedByToken = (agent: SmartAccount, typedData: ReturnType<typeof permit>, signature: Hex) =>
  client.readContract({
    account: token,
    address: agent.address,
    abi: erc1271,
    functionName: "isValidSignature",
    args: [hashTypedData(typedData), signature]
  })

const violationOf = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected a PolicyViolationError"),
    (error: unknown) => {
      assert.isTrue(PolicyViolationError.isPolicyViolationError(error), String(error))
      return (error as PolicyViolationError.PolicyViolationError).reason
    }
  )

// Every session needs a gas limit (Session.validate): the agent sets each operation's fees.
const gasLimit = Policy.gas({ maxCost: 10n ** 18n, period: "lifetime" })

const sessionWith = (policies: ReadonlyArray<Policy.Policy>, options: {
  readonly signer?: SessionKey.SessionKey | undefined
  readonly validUntil?: number | undefined
} = {}) => {
  const sessionKey = privateKeyToAccount(generatePrivateKey())
  const session = Session.from({
    signer: options.signer ?? SessionKey.ecdsa(sessionKey.address),
    validUntil: options.validUntil ?? Session.now() + 30 * 86400,
    policies: [...policies, gasLimit]
  })
  return { sessionKey, session }
}

const transfers = Policy.erc20Transfer({ token, to: [recipient], amount: { lte: 100n } })

describe("the agent's account on a Kernel account", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  const grantFor = async (
    policies: ReadonlyArray<Policy.Policy>,
    options: Parameters<typeof sessionWith>[1] & { readonly deploy?: boolean } = {}
  ) => {
    const { session, sessionKey } = sessionWith(policies, options)
    const account = await deployedAccount({ deploy: options.deploy })
    return { account, sessionKey, grant: await Grant.create({ account, session }) }
  }

  it("enables the session in its first operation and uses it in the next", async () => {
    const { grant, sessionKey } = await grantFor([transfers])
    const agent = await Grant.toAccount(client, { grant, signer: sessionKey })
    assert.strictEqual(agent.address, addressOf(grant))

    assert.isTrue((await send(agent, [transfer(10n)])).success)
    assert.isTrue(await isEnabled(grant))
    assert.isTrue((await send(agent, [transfer(20n), transfer(30n)])).success)
  })

  describe("on four lanes", () => {
    // The session's first operation (ENABLE mode, the slowest for the bundler to trace) runs before the test.
    let enabled: { readonly grant: Grant.Grant; readonly sessionKey: ReturnType<typeof privateKeyToAccount> }
    beforeEach(async () => {
      const { grant, sessionKey } = await grantFor([transfers])
      assert.isTrue((await send(await Grant.toAccount(client, { grant, signer: sessionKey }), [transfer(1n)])).success)
      enabled = { grant, sessionKey }
    })

    it("sends at once, each lane with its own nonce", async () => {
      const { grant, sessionKey } = enabled
      const agents = await Promise.all(
        [0, 1, 2, 3].map((lane) => Grant.toAccount(client, { grant, signer: sessionKey, lane }))
      )
      const nonces = await Promise.all(agents.map((agent) => agent.getNonce()))
      assert.strictEqual(new Set(nonces).size, 4)
      const bundlers = agents.map((agent) => devnet.bundlerClient(agent))
      const hashes = await Promise.all(
        bundlers.map((bundler, lane) => bundler.sendUserOperation({ calls: [transfer(BigInt(lane + 1))] }))
      )
      // A bundle takes one operation per sender.
      for (const _ of hashes) await devnet.sendBundleNow()
      const receipts = await Promise.all(
        hashes.map((hash, lane) => bundlers[lane]!.waitForUserOperationReceipt({ hash }))
      )
      assert.deepStrictEqual(receipts.map((receipt) => receipt.success), [true, true, true, true])
    })
  })

  it("signs typed data its signing policy allows, as the verifying contract checks it", async () => {
    const { grant, sessionKey } = await grantFor([
      transfers,
      Policy.signTypedData({ ...permit(0n), message: { spender: recipient, value: { lte: 10n } } })
    ])
    const agent = await Grant.toAccount(client, { grant, signer: sessionKey })
    const unchecked = await Grant.toAccount(client, { grant, signer: sessionKey, check: false })

    // Signatures need the session enabled: the first operation enables it.
    assert.strictEqual((await violationOf(agent.signTypedData(permit(5n))))._tag, "SessionNotEnabled")
    assert.isTrue((await send(agent, [transfer(1n)])).success)

    const signature = await agent.signTypedData(permit(5n))
    assert.strictEqual(await verifiedByToken(agent, permit(5n), signature), "0x1626ba7e")
    // Only for the typed data it signed, and only when the verifying contract asks.
    assert.strictEqual(await verifiedByToken(agent, permit(6n), signature), "0xffffffff")
    assert.isFalse(await client.verifyTypedData({ address: agent.address, ...permit(5n), signature }))

    // A value over the policy's bound: refused before signing, and refused by the account when signed anyway.
    assert.strictEqual((await violationOf(agent.signTypedData(permit(11n))))._tag, "SignatureNotAllowed")
    assert.strictEqual(
      await verifiedByToken(agent, permit(11n), await unchecked.signTypedData(permit(11n))),
      "0xffffffff"
    )
  })

  it("stops signing when the session expires", async () => {
    const validUntil = Number((await client.getBlock()).timestamp) + 3600
    const { grant, sessionKey } = await grantFor([
      transfers,
      Policy.signTypedData({ ...permit(0n), message: { spender: recipient } })
    ], { validUntil })
    const agent = await Grant.toAccount(client, { grant, signer: sessionKey })
    const unchecked = await Grant.toAccount(client, { grant, signer: sessionKey, check: false })
    assert.isTrue((await send(agent, [transfer(1n)])).success)

    await devnet.setTime(validUntil + 1)
    await devnet.mine()
    assert.strictEqual(
      await verifiedByToken(agent, permit(1n), await unchecked.signTypedData(permit(1n))),
      "0xffffffff"
    )
    assert.deepInclude(await violationOf(agent.signTypedData(permit(1n))), { _tag: "SessionExpired", validUntil })
    assert.strictEqual((await violationOf(send(agent, [transfer(1n)])))._tag, "SessionExpired")
  })

  it("refuses calls its policies don't allow before signing", async () => {
    const { grant, sessionKey } = await grantFor([transfers])
    const agent = await Grant.toAccount(client, { grant, signer: sessionKey })
    assert.isTrue((await send(agent, [transfer(1n)])).success)

    assert.deepInclude(await violationOf(send(agent, [transferTo(stranger, 1n)])), {
      _tag: "ArgumentRejected",
      call: 0,
      policy: "arguments"
    })
    assert.strictEqual((await violationOf(send(agent, [{ to: stranger, data: "0x" }])))._tag, "CallNotAllowed")
  })

  it("refuses spending past a budget before signing, with what is left and when it resets", async () => {
    const { grant, sessionKey } = await grantFor([transfers, Policy.spend({ token, amount: 100n, period: "day" })])
    const agent = await Grant.toAccount(client, { grant, signer: sessionKey })
    assert.isTrue((await send(agent, [transfer(60n)])).success)

    const spent = await violationOf(send(agent, [transfer(50n)]))
    assert.deepInclude(spent, { _tag: "SpendLimitExceeded", attempted: 50n, remaining: 40n })
    // Periods are epoch-aligned: a daily budget resets at the next UTC midnight.
    const now = Number((await client.getBlock()).timestamp)
    assert.strictEqual(
      (spent as PolicyViolationError.SpendLimitExceeded).resetsAt,
      (Math.floor(now / 86400) + 1) * 86400
    )
    // Without the check, the bundler refuses it in validation instead.
    const unchecked = await Grant.toAccount(client, { grant, signer: sessionKey, check: false })
    assert.match(await refusal(send(unchecked, [transfer(50n)])), /AA2/)
  })

  // Internal review, finding 1: the fallback (`Policy.anyCall`) never reaches the account's own modules, which take
  // its calls as configuration; the module probes Smart Sessions makes for that pass the bundler's ERC-7562 rules.
  it("sends any call through Policy.anyCall, but never to the account's owner validator", async () => {
    const { grant, sessionKey } = await grantFor([Policy.anyCall({ unsafe: true })])
    const agent = await Grant.toAccount(client, { grant, signer: sessionKey, check: false })

    assert.isTrue((await send(agent, [transfer(1n), { to: stranger, data: "0x12345678" }])).success)
    // `onUninstall(bytes)` on the owner's validator would remove the owner.
    const uninstall = encodeFunctionData({
      abi: parseAbi(["function onUninstall(bytes)"]),
      functionName: "onUninstall",
      args: ["0x"]
    })
    assert.match(
      await refusal(send(agent, [{ to: External.kernel["3.3"].ecdsaValidator, data: uninstall }])),
      /AA2|validateUserOp/
    )
  })

  it("sends with a passkey session key", async () => {
    const passkey = newPasskey()
    const { grant } = await grantFor([transfers], { signer: SessionKey.passkey({ publicKey: passkey.publicKey }) })
    const agent = await Grant.toAccount(client, { grant, signer: passkey })

    assert.isTrue((await send(agent, [transfer(10n)])).success)
    assert.isTrue((await send(agent, [transfer(10n)])).success)
  })
})

describe("Grant.toAccount and Grant.check", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  const reasonOf = (promise: Promise<unknown>) =>
    promise.then(
      () => assert.fail("expected a GrantError"),
      (error: unknown) => {
        assert.isTrue(GrantError.isGrantError(error), String(error))
        return (error as GrantError.GrantError).reason._tag
      }
    )

  // Kernel deploys through ZeroDev's staked FactoryStaker, so a bundler that enforces ERC-7562 accepts it.
  it("deploys an undeployed Kernel account in the agent's first operation", async () => {
    const { session, sessionKey } = sessionWith([transfers])
    const grant = await Grant.create({ account: await deployedAccount({ deploy: false }), session })
    assert.isDefined(grant.accountType.deployment)
    const agent = await Grant.toAccount(client, { grant, signer: sessionKey })

    assert.isTrue((await send(agent, [transfer(10n)])).success)
    assert.isDefined(await client.getCode({ address: agent.address }))
    assert.isTrue(await isEnabled(grant))
  })

  it("refuses a signer that isn't the session key, an uncovered chain and a lane out of range", async () => {
    const { session, sessionKey } = sessionWith([transfers])
    const grant = await Grant.create({ account: await deployedAccount(), session })
    const second = await Devnet.from(inject(Devnet.contextKey), { chain: "second" })

    assert.strictEqual(
      await reasonOf(Grant.toAccount(client, { grant, signer: privateKeyToAccount(generatePrivateKey()) })),
      "SignerMismatch"
    )
    assert.strictEqual(await reasonOf(Grant.toAccount(client, { grant, signer: newPasskey() })), "SignerMismatch")
    assert.strictEqual(await reasonOf(Grant.toAccount(second.client, { grant, signer: sessionKey })), "ChainNotCovered")
    await Grant.toAccount(client, { grant, signer: sessionKey, lane: 2 ** 16 - 1 })
    await Grant.toAccount(client, { grant, signer: sessionKey, lane: 2 ** 16 }).then(
      () => assert.fail("expected the lane to be refused"),
      (error: unknown) => assert.match(String(error), /lane/)
    )
  })

  it("needs as many signers as the session key's threshold", async () => {
    const [a, b, c] = [0, 1, 2].map(() => privateKeyToAccount(generatePrivateKey()))
    const { session } = sessionWith([transfers], {
      signer: SessionKey.ecdsaThreshold({ threshold: 2, signers: [a!.address, b!.address, c!.address] })
    })
    const grant = await Grant.create({ account: await deployedAccount(), session })

    assert.strictEqual(await reasonOf(Grant.toAccount(client, { grant, signer: a! })), "SignerMismatch")
    const agent = await Grant.toAccount(client, { grant, signer: [c!, a!] })
    assert.isTrue((await send(agent, [transfer(1n)])).success)
  })

  it("checks calls without a key, and simulates them once the account is deployed", async () => {
    const { session, sessionKey } = sessionWith([transfers, Policy.rateLimit({ count: 1, period: "hour" })])
    const grant = await Grant.create({ account: await deployedAccount({ deploy: false }), session })

    assert.deepStrictEqual(await Grant.check(client, { grant, calls: [transfer(5n)] }), {
      ok: true,
      violations: [],
      simulation: undefined
    })
    const refused = await Grant.check(client, { grant, calls: [transfer(500n)] })
    assert.isFalse(refused.ok)
    assert.deepStrictEqual(refused.violations.map((violation) => violation._tag), ["ArgumentRejected"])

    assert.isTrue((await send(await Grant.toAccount(client, { grant, signer: sessionKey }), [transfer(1n)])).success)
    const limited = await Grant.check(client, { grant, calls: [transfer(5n)] })
    assert.deepStrictEqual(limited.violations.map((violation) => violation._tag), ["RateLimited"])
    assert.deepStrictEqual(limited.simulation, { reverted: false })
  })

  it("doesn't sign personal messages: Smart Sessions verifies typed data only", async () => {
    const { session, sessionKey } = sessionWith([transfers])
    const grant = await Grant.create({ account: await deployedAccount(), session })
    const agent = await Grant.toAccount(client, { grant, signer: sessionKey })

    await agent.signMessage({ message: "hello" }).then(
      () => assert.fail("expected signMessage to be refused"),
      (error: unknown) => assert.match(String(error), /typed data/)
    )
  })
})
