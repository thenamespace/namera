import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { SmartSession } from "@namera-ai/contracts"
import { Policy, Session, SessionKey } from "@namera-ai/sdk"
import * as P256 from "ox/P256"
import * as PublicKey from "ox/PublicKey"
import { encodeFunctionData, parseAbi } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

import { client, devnet } from "./accounts/accounts.test-utils.ts"
import { deployedAccount, enable, refusal, sessionAgent } from "./session.test-utils.ts"

// Compiled sessions against the deployed contracts: the permission id Smart Sessions computes, and on Kernel
// (safe-mode alto) that what a session's policies allow passes validation and what they don't is refused. Tokens and routers are plain addresses: policies run during validation, so calls to them only need to
// execute.

const sessionKey = privateKeyToAccount(generatePrivateKey())
const token = privateKeyToAccount(generatePrivateKey()).address
const router = privateKeyToAccount(generatePrivateKey()).address
const recipient = privateKeyToAccount(generatePrivateKey()).address
const stranger = privateKeyToAccount(generatePrivateKey()).address

const erc20 = parseAbi(["function transfer(address to, uint256 amount)"])
const routerAbi = [{
  type: "function",
  name: "swap",
  stateMutability: "payable",
  inputs: [{
    name: "params",
    type: "tuple",
    components: [{ name: "recipient", type: "address" }, { name: "fee", type: "uint24" }, {
      name: "amountIn",
      type: "uint256"
    }]
  }],
  outputs: []
}] as const

const transferTo = (to: `0x${string}`, amount: bigint) => ({
  to: token,
  data: encodeFunctionData({ abi: erc20, functionName: "transfer", args: [to, amount] })
})
const swap = (to: `0x${string}`, amountIn: bigint) => ({
  to: router,
  data: encodeFunctionData({ abi: routerAbi, functionName: "swap", args: [{ recipient: to, fee: 500, amountIn }] })
})

const sessionWith = (policies: ReadonlyArray<Policy.Policy>) =>
  Session.from({
    signer: SessionKey.ecdsa(sessionKey.address),
    validUntil: Session.now() + 30 * 86400,
    policies
  })

describe("Session.getPermissionId", () => {
  it("equals what Smart Sessions computes for the compiled session, for each kind of session key", async () => {
    const passkey = PublicKey.toHex(P256.getPublicKey({ privateKey: P256.randomPrivateKey() }))
    const sessions = [
      sessionWith([Policy.nativeTransfer({ to: recipient })]),
      Session.from({
        signer: SessionKey.passkey({ publicKey: passkey }),
        validUntil: "never",
        unsafe: true,
        policies: [Policy.anyCall({ unsafe: true })]
      })
    ]
    for (const session of sessions) {
      const onChain = await client.readContract({
        ...SmartSession.v1,
        functionName: "getPermissionId",
        args: [Session.toSmartSession(session)]
      })
      assert.strictEqual(onChain, Session.getPermissionId(session))
    }
  })
})

describe("a compiled session on a Kernel account", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  const setUp = async (session: Session.Session, options?: { readonly statesTime?: boolean }) => {
    const account = await deployedAccount()
    await enable(account, session)
    assert.isTrue(
      await client.readContract({
        ...SmartSession.v1,
        functionName: "isPermissionEnabled",
        args: [Session.getPermissionId(session), account.address]
      })
    )
    const agent = await sessionAgent({ address: account.address, session, sessionKey, ...options })
    return { account, agent }
  }

  it("allows a transfer its conditions allow, and refuses the recipient or amount they don't", async () => {
    const session = sessionWith([Policy.erc20Transfer({ token, to: [recipient], amount: { lte: 100n } })])
    const { agent } = await setUp(session)

    assert.isTrue((await devnet.sendUserOperation(agent, [transferTo(recipient, 100n)])).success)
    assert.match(await refusal(devnet.sendUserOperation(agent, [transferTo(stranger, 1n)])), /AA2/)
    assert.match(await refusal(devnet.sendUserOperation(agent, [transferTo(recipient, 101n)])), /AA2/)
  })

  it("checks a struct's fields and a native transfer's value, and refuses calls nothing allows", async () => {
    const session = sessionWith([
      Policy.function({
        address: router,
        abi: routerAbi,
        functionName: "swap",
        args: { params: { recipient, amountIn: { lte: 50n } } }
      }),
      Policy.nativeTransfer({ to: recipient, value: { lte: 5n } })
    ])
    const { agent } = await setUp(session)

    assert.isTrue((await devnet.sendUserOperation(agent, [swap(recipient, 50n), { to: recipient, value: 5n }])).success)
    assert.match(await refusal(devnet.sendUserOperation(agent, [swap(recipient, 51n)])), /AA2/)
    assert.match(await refusal(devnet.sendUserOperation(agent, [{ to: recipient, value: 6n }])), /AA2/)
    assert.match(await refusal(devnet.sendUserOperation(agent, [{ to: stranger, value: 1n }])), /AA2/)
  })

  it("counts a daily spend limit across operations at the stated time", async () => {
    const session = sessionWith([
      Policy.erc20Transfer({ token, to: [recipient] }),
      Policy.spend({ token, amount: 150n, period: "day" })
    ])
    const { agent } = await setUp(session, { statesTime: true })

    assert.isTrue((await devnet.sendUserOperation(agent, [transferTo(recipient, 100n)])).success)
    assert.match(await refusal(devnet.sendUserOperation(agent, [transferTo(recipient, 51n)])), /AA2/)
    assert.isTrue((await devnet.sendUserOperation(agent, [transferTo(recipient, 50n)])).success)
  })

  it("enables a session using every limit and signing policy, as their contracts accept the compiled configs", async () => {
    const session = sessionWith([
      Policy.anyCall({ unsafe: true }),
      Policy.approvals({ tokens: [token], spenders: [router], maxAmount: 10n }),
      Policy.spend({ token, amount: 1n, period: "lifetime" }),
      Policy.value({ amount: 1n, period: "week" }),
      Policy.rateLimit({ count: 3, period: "hour" }),
      Policy.gas({ maxCost: 10n ** 18n, period: "day" }),
      Policy.signTypedData({
        domain: { name: "Token", version: "1", chainId: devnet.chain.id, verifyingContract: token },
        types: { Permit: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }] },
        primaryType: "Permit",
        message: { spender: router, value: { lte: 10n } }
      })
    ])
    await setUp(session)
  })
})
