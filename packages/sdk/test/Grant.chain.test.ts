import { afterEach, assert, beforeEach, describe, inject, it } from "@effect/vitest"
import { SmartSession } from "@namera-ai/contracts"
import { Devnet } from "@namera-ai/devnet"
import { Grant, GrantError, Policy, Session, SessionKey } from "@namera-ai/sdk"
import { encodeFunctionData, parseAbi } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

import { client, devnet, newOwner } from "./accounts/accounts.test-utils.ts"
import { newPasskey } from "./accounts/passkey.test-utils.ts"
import { deployedAccount } from "./session.test-utils.ts"

// Grants on the devnet (safe-mode alto): the owner signs once and sends nothing, and the agent's first operation
// (through `Grant.toAccount`) enables the session (Smart Sessions' ENABLE mode) and uses it. The devnet's second chain (31338) covers multichain
// grants.

const second = await Devnet.from(inject(Devnet.contextKey), { chain: "second" })

const sessionKey = privateKeyToAccount(generatePrivateKey())
const token = privateKeyToAccount(generatePrivateKey()).address
const recipient = privateKeyToAccount(generatePrivateKey()).address
const transfer = {
  to: token,
  data: encodeFunctionData({
    abi: parseAbi(["function transfer(address to, uint256 amount)"]),
    functionName: "transfer",
    args: [recipient, 10n]
  })
}

const newSession = () =>
  Session.from({
    signer: SessionKey.ecdsa(sessionKey.address),
    validUntil: Session.now() + 30 * 86400,
    policies: [
      Policy.erc20Transfer({ token, to: [recipient], amount: { lte: 100n } }),
      // Every session needs a gas limit (Session.validate): the agent sets each operation's fees.
      Policy.gas({ maxCost: 10n ** 18n, period: "lifetime" })
    ]
  })

const isEnabled = (on: Devnet.Devnet, session: Session.Session, account: `0x${string}`) =>
  on.client.readContract({
    ...SmartSession.v1,
    functionName: "isPermissionEnabled",
    args: [Session.getPermissionId(session), account]
  })

const reasonOf = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected a GrantError"),
    (error: unknown) => {
      assert.isTrue(GrantError.isGrantError(error))
      return (error as GrantError.GrantError).reason._tag
    }
  )

describe("a grant on a Kernel account", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("signs the contract's session digest, and verifies", async () => {
    const account = await deployedAccount()
    const session = newSession()
    const grant = await Grant.create({ account, session })

    // The digest the owner signed is the contract's.
    const onChain = await client.readContract({
      ...SmartSession.v1,
      functionName: "getSessionDigest",
      args: [Session.getPermissionId(session), account.address, Session.toSmartSession(session), 1]
    })
    assert.strictEqual(grant.chains[0]!.sessionDigest, onChain)
    await Grant.verify(client, grant)
  })

  it("verifies, and refuses an altered session or another owner's signature", async () => {
    const account = await deployedAccount()
    const other = await deployedAccount()
    const session = newSession()
    const grant = await Grant.create({ account, session })
    const stranger = await Grant.create({ account: other, session })

    // An altered policy no longer matches the digest the owner signed.
    const altered: Grant.Grant = {
      ...grant,
      session: { ...grant.session, policies: [Policy.erc20Transfer({ token, amount: { lte: 1000n } })] }
    }
    assert.strictEqual(await reasonOf(Grant.verify(client, altered)), "DigestMismatch")
    assert.strictEqual(
      await reasonOf(Grant.verify(client, { ...grant, chains: [{ ...grant.chains[0]!, ...signatureOf(stranger) }] })),
      "InvalidSignature"
    )
    assert.strictEqual(await reasonOf(Grant.verify(second.client, grant)), "ChainNotCovered")
  })

  it("is enabled by the owner with installSync, without a signature", async () => {
    const account = await deployedAccount()
    const session = newSession()
    const { grant, receipt } = await Grant.installSync(devnet.bundlerClient(account, { bundleOnReceipt: true }), {
      session
    })

    assert.strictEqual(receipt.status, "success")
    assert.isTrue(await isEnabled(devnet, session, account.address))
    assert.strictEqual(grant.chains[0]!.signature, "0x")
    await Grant.verify(client, grant)
    const agent = await Grant.toAccount(client, { grant, signer: sessionKey })
    assert.isTrue((await devnet.sendUserOperation(agent, [transfer])).success)
  })

  it("is signed by a passkey owner through WebAuthnValidator", async () => {
    const account = await deployedAccount({ owner: newPasskey() })
    const session = newSession()
    const grant = await Grant.create({ account, session })
    await Grant.verify(client, grant)

    const agent = await Grant.toAccount(client, { grant, signer: sessionKey })
    assert.isTrue((await devnet.sendUserOperation(agent, [transfer])).success)
    assert.isTrue(await isEnabled(devnet, session, account.address))
  })

  // An EIP-7702 account checks the owner's raw EIP-712 signature against its own address, not through a validator.
  it("is signed by an EIP-7702 account's own key, and enabled by the agent's first operation", async () => {
    const account = await deployedAccount({ eip7702: true })
    const session = newSession()
    const grant = await Grant.create({ account, session })
    await Grant.verify(client, grant)

    const agent = await Grant.toAccount(client, { grant, signer: sessionKey })
    assert.isTrue((await devnet.sendUserOperation(agent, [transfer])).success)
    assert.isTrue(await isEnabled(devnet, session, account.address))
  })
})

const signatureOf = (grant: Grant.Grant) => ({ signature: grant.chains[0]!.signature })

describe("a multichain grant on a Kernel account", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })
  second.isolate({ beforeEach, afterEach })

  const multichain = async (options: { readonly deployFirst: boolean }) => {
    const owner = newOwner()
    const first = await deployedAccount({ owner, deploy: options.deployFirst })
    const other = await deployedAccount({ owner, on: second })
    assert.strictEqual(other.address, first.address)
    const session = newSession()
    return { address: first.address, session, grant: await Grant.create({ account: [first, other], session }) }
  }

  it("covers both chains, signed once per chain, and verifies on each", async () => {
    const { grant } = await multichain({ deployFirst: true })
    assert.deepStrictEqual(grant.chains.map((chain) => chain.chain), [
      `eip155:${devnet.chain.id}`,
      `eip155:${second.chain.id}`
    ])
    // Kernel binds the chain in its ERC-1271 domain.
    assert.notStrictEqual(grant.chains[0]!.signature, grant.chains[1]!.signature)
    await Grant.verify(client, grant)
    await Grant.verify(second.client, grant)
  })

  it("is enabled on the second chain by the agent's first operation there", async () => {
    // Only the second chain's account needs to exist: the grant's first-chain entry isn't used here.
    const { address, grant, session } = await multichain({ deployFirst: false })
    const agent = await Grant.toAccount(second.client, { grant, signer: sessionKey })
    assert.isTrue((await second.sendUserOperation(agent, [transfer])).success)
    assert.isTrue(await isEnabled(second, session, address))
    assert.isFalse(await isEnabled(devnet, session, address))
  })
})
