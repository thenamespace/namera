import { assert, describe, it } from "@effect/vitest"
import { Grant, GrantError, Policy, Session, SessionKey } from "@namera-ai/sdk"
import { sessionDigest, toTypedData } from "@namera-ai/sdk/internal/core/grant/typedData"
import { contracts } from "@namera-ai/sdk/internal/session/contracts"
import * as SignatureErc6492 from "ox/erc6492/SignatureErc6492"

const account = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const passkey =
  "0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"

const sessions = [
  Session.from({
    signer: SessionKey.ecdsa("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
    validUntil: 2_000_000_000,
    label: "checkout",
    policies: [
      Policy.erc20Transfer({ token: USDC, to: [account], amount: { lte: 50_000000n } }),
      Policy.spend({ token: USDC, amount: 200_000000n, period: "day" }),
      Policy.rateLimit({ count: 5, period: { seconds: 600 } })
    ]
  }),
  Session.from({
    signer: SessionKey.passkey({ publicKey: passkey }),
    validUntil: "never",
    unsafe: true,
    sponsored: true,
    policies: [
      Policy.anyCall({ unsafe: true }),
      Policy.signTypedData({
        domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: USDC },
        types: { Permit: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }] },
        primaryType: "Permit",
        message: { value: { between: [1n, 5n] } }
      })
    ]
  })
]

/** A grant over chains 8453 and 10, with a stand-in signature (`Grant.verify` would refuse it). */
const grantOf = (session: Session.Session): Grant.Grant => {
  const chains = [8453, 10].map((chainId) => ({
    chain: `eip155:${chainId}` as const,
    contracts,
    nonce: BigInt(chainId === 10 ? 3 : 0),
    sessionDigest: sessionDigest({
      chainId,
      account,
      compiled: Session.toSmartSession(session),
      smartSession: contracts.smartSession,
      nonce: BigInt(chainId === 10 ? 3 : 0)
    })
  }))
  return Grant.from({
    account: `eip155:8453:${account}`,
    accountType: { type: "kernel", version: "3.3" },
    session,
    chains,
    typedData: toTypedData([]),
    signature: `0x${"ab".repeat(65)}`
  })
}

const reasonOf = (thunk: () => unknown) => {
  try {
    thunk()
  } catch (error) {
    assert.isTrue(GrantError.isGrantError(error))
    return (error as GrantError.GrantError).reason
  }
  return assert.fail("expected a GrantError")
}

describe("Grant.serialize and Grant.parse", () => {
  for (const [index, session] of sessions.entries()) {
    it(`round-trip a grant through JSON and the token (session ${index})`, () => {
      const grant = grantOf(session)
      const json = Grant.serialize(grant)
      const token = Grant.serialize(grant, { format: "token" })

      assert.isTrue(token.startsWith("nmr1_"))
      assert.match(token, /^nmr1_[A-Za-z0-9_-]+$/)
      assert.deepStrictEqual(Grant.parse(json), grant)
      assert.deepStrictEqual(Grant.parse(token), grant)
      // Canonical: serializing the parsed grant gives the same text.
      assert.strictEqual(Grant.serialize(Grant.parse(token)), json)
    })
  }

  it("refuses other versions, unknown fields, and a session that isn't the grant's", () => {
    const grant = JSON.parse(Grant.serialize(grantOf(sessions[0]!))) as Record<string, unknown>

    assert.deepInclude(reasonOf(() => Grant.parse({ ...grant, version: 2 })), {
      _tag: "VersionUnsupported",
      version: 2
    })
    assert.strictEqual(reasonOf(() => Grant.parse(JSON.stringify({ ...grant, privateKey: "0x01" })))._tag, "Malformed")
    assert.strictEqual(
      reasonOf(() => Grant.parse(JSON.stringify({ ...grant, id: `0x${"00".repeat(32)}` })))._tag,
      "Malformed"
    )
    assert.strictEqual(
      reasonOf(() =>
        Grant.parse(JSON.stringify({ ...grant, session: { ...(grant.session as object), validUntil: "never" } }))
      )._tag,
      "Malformed"
    )
    assert.strictEqual(reasonOf(() => Grant.parse(JSON.stringify({ ...grant, chains: [] })))._tag, "Malformed")
    // Namera supports Kernel only: a grant for another account type is malformed.
    assert.strictEqual(
      reasonOf(() => Grant.parse(JSON.stringify({ ...grant, accountType: { type: "nexus", version: "1.3.3" } })))._tag,
      "Malformed"
    )
    assert.strictEqual(reasonOf(() => Grant.parse("not a grant"))._tag, "Malformed")
    assert.strictEqual(reasonOf(() => Grant.parse("nmr1_***"))._tag, "Malformed")
  })
})

describe("Grant.from", () => {
  it("needs a signature on every chain, keeping it without an ERC-6492 wrapper", () => {
    const grant = grantOf(sessions[0]!)
    const prepared = { ...grant, typedData: toTypedData([]) }
    assert.deepInclude(reasonOf(() => Grant.from({ ...prepared, signatures: { 8453: "0x1234" } })), {
      _tag: "InvalidSignature",
      chain: "eip155:10"
    })

    const raw = "0x1234"
    const wrapped = SignatureErc6492.wrap({ to: account, data: "0xabcd", signature: raw })
    const signed = Grant.from({ ...prepared, signatures: { 8453: wrapped, 10: raw } })
    assert.deepStrictEqual(signed.chains.map((chain) => chain.signature), [raw, raw])
  })
})

describe("Grant.updateCalls", () => {
  // Internal review, finding 10: with Policy.anyCall kept, a removed call policy's calls would go through the
  // fallback without its conditions.
  it("refuses removing a call policy while Policy.anyCall stays, and allows it with anyCall removed too", () => {
    const transfer = Policy.erc20Transfer({ token: USDC, to: [account], amount: { lte: 1n } })
    const anyCall = Policy.anyCall({ unsafe: true })
    const gas = Policy.gas({ maxCost: 10n ** 16n, period: "day" })
    const grant = grantOf(
      Session.from({
        signer: SessionKey.ecdsa(account),
        validUntil: 2_000_000_000,
        unsafe: true,
        policies: [transfer, anyCall, gas]
      })
    )

    assert.deepInclude(reasonOf(() => Grant.updateCalls(grant, { remove: [transfer] })), {
      _tag: "RemovalWidens",
      index: 0
    })
    const { calls, session } = Grant.updateCalls(grant, { remove: [transfer, anyCall] })
    assert.isAbove(calls.length, 0)
    assert.notDeepInclude(session.policies, anyCall)
  })
})

describe("Grant.describe", () => {
  it("names the account and chains, then the session, recomputed rather than read from the summary", () => {
    const grant = { ...grantOf(sessions[0]!), summary: ["May do anything."] }
    const lines = Grant.describe(grant)

    assert.strictEqual(lines[0], `For the kernel account ${account} on eip155:8453, eip155:10.`)
    assert.deepStrictEqual(lines.slice(1), Session.describe(grant.session))
    assert.notInclude(lines, "May do anything.")
  })
})
