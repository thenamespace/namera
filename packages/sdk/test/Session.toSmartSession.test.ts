import { assert, describe, it } from "@effect/vitest"
import {
  AllowPolicy,
  ApprovalPolicy,
  ArgPolicy,
  ECDSASessionValidator,
  GasPolicy,
  RateLimitPolicy,
  SessionHook,
  SignaturePolicy,
  SpendPolicy,
  ValuePolicy,
  WebAuthnValidator
} from "@namera-ai/contracts"
import { Policy, Session, SessionKey } from "@namera-ai/sdk"
import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"
import * as TypedData from "ox/TypedData"

// The compiler's output, decoded as each policy contract decodes its init data.

const agent = SessionKey.ecdsa("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const DAI = "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"
const merchant = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
const treasury = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"
const router = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD"
const permit2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3"
const salt = `0x${"22".repeat(32)}` as const
const VALUE = 2n ** 256n - 1n

const word = (value: bigint) => Hex.fromNumber(value, { size: 32 })
const addressWord = (address: string) => Hex.padLeft(address.toLowerCase() as Hex.Hex, 32)

const rules = AbiParameters.from(["(uint8 condition, uint256 offset, bytes32[] refs)[]"])
const decodeRules = (initData: Hex.Hex) => AbiParameters.decode(rules, initData)[0]

const compile = (policies: ReadonlyArray<Policy.Policy>, overrides: Partial<Session.from.Options> = {}) =>
  Session.toSmartSession(Session.from({ signer: agent, validUntil: 2_000_000_000, policies, salt, ...overrides }))

const actionOf = (struct: Session.SmartSession, target: string, selector: string) => {
  const action = struct.actions.find((entry) =>
    entry.actionTarget.toLowerCase() === target.toLowerCase() && entry.actionTargetSelector === selector
  )
  assert.isDefined(action, `no action for ${selector} on ${target}`)
  return action!
}

describe("Session.toSmartSession", () => {
  it("compiles an ERC-20 transfer to an ArgPolicy action on the token", () => {
    const struct = compile([Policy.erc20Transfer({ token: USDC, to: [merchant, treasury], amount: { lte: 50n } })])
    const action = actionOf(struct, USDC, "0xa9059cbb")

    assert.strictEqual(action.actionPolicies.length, 1)
    assert.strictEqual(action.actionPolicies[0]!.policy, ArgPolicy.v1.address)
    assert.deepStrictEqual(decodeRules(action.actionPolicies[0]!.initData), [
      { condition: 7, offset: 0n, refs: [addressWord(merchant), addressWord(treasury)] },
      { condition: 3, offset: 32n, refs: [word(50n)] }
    ])
  })

  it("reads a struct's fields inline, and the value at ArgPolicy's VALUE offset", () => {
    const abi = [{
      type: "function",
      name: "exactInputSingle",
      stateMutability: "payable",
      inputs: [{
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" }
        ]
      }],
      outputs: []
    }] as const
    const struct = compile([
      Policy.function({
        address: router,
        abi,
        functionName: "exactInputSingle",
        args: { params: { tokenIn: USDC, fee: [500n, 3000n], recipient: merchant, amountIn: { between: [1n, 9n] } } },
        value: 0n
      })
    ])
    const action = actionOf(struct, router, AbiFunction.getSelector(abi[0]))

    assert.deepStrictEqual(decodeRules(action.actionPolicies[0]!.initData), [
      { condition: 0, offset: 0n, refs: [addressWord(USDC)] },
      { condition: 7, offset: 64n, refs: [word(500n), word(3000n)] },
      { condition: 0, offset: 96n, refs: [addressWord(merchant)] },
      { condition: 6, offset: 128n, refs: [word(1n), word(9n)] },
      { condition: 0, offset: VALUE, refs: [word(0n)] }
    ])
  })

  it("allows calls without conditions through AllowPolicy, a native transfer by the value selector", () => {
    const struct = compile([
      Policy.nativeTransfer({ to: [merchant, treasury] }),
      Policy.call({ to: router, selector: "0x414BF389" })
    ])

    assert.deepStrictEqual(struct.actions.map((action) => [action.actionTarget, action.actionTargetSelector]), [
      [merchant, "0xffffffff"],
      [router, "0x414bf389"],
      [treasury, "0xffffffff"]
    ])
    for (const action of struct.actions) {
      assert.deepStrictEqual(action.actionPolicies, [{ policy: AllowPolicy.v1.address, initData: "0x" }])
    }
  })

  it("compiles limits to user operation policies, each period in seconds", () => {
    const struct = compile([
      Policy.erc20Transfer({ token: USDC, to: merchant, amount: 1n }),
      Policy.spend({ token: USDC, amount: 200n, period: "day" }),
      Policy.spend({ token: DAI, amount: 5n, period: "lifetime" }),
      Policy.value({ amount: 7n, period: "week" }),
      Policy.rateLimit({ count: 20, period: "hour" }),
      Policy.gas({ maxCost: 9n, period: { seconds: 600 } })
    ])
    const byPolicy = new Map(struct.userOpPolicies.map((entry) => [entry.policy, entry.initData]))
    const pair = AbiParameters.from(["uint256", "uint256"])

    assert.deepStrictEqual(
      AbiParameters.decode(
        AbiParameters.from(["(address token, uint256 amount, uint256 period, bool countApprovals)[]"]),
        byPolicy.get(SpendPolicy.v1.address)!
      )[0],
      [
        { token: USDC, amount: 200n, period: 86400n, countApprovals: true },
        { token: DAI, amount: 5n, period: 0n, countApprovals: true }
      ]
    )
    assert.deepStrictEqual(AbiParameters.decode(pair, byPolicy.get(ValuePolicy.v1.address)!), [7n, 604800n])
    assert.deepStrictEqual(AbiParameters.decode(pair, byPolicy.get(RateLimitPolicy.v1.address)!), [20n, 3600n])
    assert.deepStrictEqual(AbiParameters.decode(pair, byPolicy.get(GasPolicy.v1.address)!), [9n, 600n])
  })

  it("puts ApprovalPolicy on approvals of its tokens, and stops spend counting them", () => {
    const struct = compile([
      Policy.erc20Approve({ token: USDC, spender: permit2, amount: { lte: 10n } }),
      Policy.spend({ token: USDC, amount: 200n, period: "day" }),
      Policy.approvals({ tokens: [USDC], spenders: [permit2], maxAmount: 10n })
    ])
    const approve = actionOf(struct, USDC, "0x095ea7b3")

    assert.deepStrictEqual(approve.actionPolicies.map((entry) => entry.policy), [
      ArgPolicy.v1.address,
      ApprovalPolicy.v1.address
    ])
    assert.deepStrictEqual(
      AbiParameters.decode(
        AbiParameters.from(["address[]", "(address token, uint256 maxAmount)[]"]),
        approve.actionPolicies[1]!.initData
      ),
      [[permit2], [{ token: USDC, maxAmount: 10n }]]
    )
    const limits = AbiParameters.decode(
      AbiParameters.from(["(address token, uint256 amount, uint256 period, bool countApprovals)[]"]),
      struct.userOpPolicies[0]!.initData
    )[0]
    // Rerun review: a capped approval still counts against the spend budget, or approve-then-pull would bypass it.
    assert.isTrue(limits[0]!.countApprovals)
  })

  // Internal review, finding 14: tokens with different decimals get their own caps.
  it("gives each token of Policy.approvals its own cap", () => {
    const dai = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    const struct = compile([
      Policy.anyCall({ unsafe: true }),
      Policy.approvals({ tokens: [USDC, dai], spenders: [permit2], maxAmount: { [USDC]: 10n, [dai]: 10n ** 19n } })
    ])
    const [, caps] = AbiParameters.decode(
      AbiParameters.from(["address[]", "(address token, uint256 maxAmount)[]"]),
      actionOf(struct, USDC, "0x095ea7b3").actionPolicies[0]!.initData
    )
    assert.deepStrictEqual(caps, [{ token: USDC, maxAmount: 10n }, { token: dai, maxAmount: 10n ** 19n }])
    assert.throws(() =>
      Session.from({
        signer: SessionKey.ecdsa(permit2),
        validUntil: 2_000_000_000,
        policies: [Policy.approvals({ tokens: [USDC, dai], spenders: [permit2], maxAmount: { [USDC]: 10n } })]
      })
    )
  })

  // Internal review, finding 8: a lower bound on a narrow integer also caps the word at the type's range.
  it("adds a range rule to a lower bound on an integer narrower than 256 bits", () => {
    const abi = [{
      type: "function",
      name: "fill",
      stateMutability: "nonpayable",
      inputs: [{ name: "fee", type: "uint24" }, { name: "amount", type: "uint256" }],
      outputs: []
    }] as const
    const struct = compile([
      Policy.function({
        address: permit2,
        abi,
        functionName: "fill",
        args: { fee: { gte: 500n }, amount: { gte: 1n } }
      })
    ])
    const [rules] = AbiParameters.decode(
      AbiParameters.from(["(uint8 condition, uint256 offset, bytes32[] refs)[]"]),
      actionOf(struct, permit2, AbiFunction.getSelector(AbiFunction.fromAbi(abi, "fill"))).actionPolicies[0]!.initData
    )
    assert.deepStrictEqual(rules.map((rule) => [rule.condition, rule.offset]), [[5, 0n], [3, 0n], [5, 32n]])
    assert.strictEqual(BigInt(rules[1]!.refs[0]!), 2n ** 24n - 1n)
  })

  it("with any call allowed, gives approvals actions of their own next to the fallback", () => {
    const struct = compile([
      Policy.anyCall({ unsafe: true }),
      Policy.approvals({ tokens: [USDC], spenders: [permit2], maxAmount: 10n })
    ])

    assert.deepStrictEqual(struct.actions.map((action) => [action.actionTarget, action.actionTargetSelector]), [
      ["0x0000000000000000000000000000000000000001", "0x00000001"],
      [permit2, "0x87517c45"],
      [USDC, "0x095ea7b3"],
      [USDC, "0x39509351"]
    ])
    assert.deepStrictEqual(actionOf(struct, USDC, "0x39509351").actionPolicies.map((entry) => entry.policy), [
      ApprovalPolicy.v1.address
    ])
    assert.deepStrictEqual(
      actionOf(struct, "0x0000000000000000000000000000000000000001", "0x00000001").actionPolicies,
      [
        { policy: AllowPolicy.v1.address, initData: "0x" }
      ]
    )
  })

  it("lists execution policies in SessionHook's init data", () => {
    const guard = "0x1111111111111111111111111111111111111111"
    const struct = compile([
      Policy.nativeTransfer({ to: merchant }),
      Policy.rateLimit({ count: 1, period: "day" }),
      Policy.gas({ maxCost: 1n, period: "day" }),
      Policy.execution({ address: guard, initData: "0xabcd" })
    ])
    const hook = struct.userOpPolicies.find((entry) => entry.policy === SessionHook.v1.address)!

    assert.deepStrictEqual(
      AbiParameters.decode(AbiParameters.from(["(address policy, bytes initData)[]"]), hook.initData)[0],
      [{ policy: guard, initData: "0xabcd" }]
    )
  })

  it("compiles typed-data signing to ERC-7739 contents and SignaturePolicy field rules", () => {
    const domain = { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: USDC } as const
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    } as const
    const struct = compile([
      Policy.signTypedData({ domain, types, primaryType: "Permit", message: { spender: merchant, value: { lte: 5n } } })
    ])
    const contentsType = "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"

    assert.deepStrictEqual(struct.erc7739Policies.allowedERC7739Content, [
      { appDomainSeparator: TypedData.domainSeparator(domain), contentNames: [contentsType] }
    ])
    const policy = struct.erc7739Policies.erc1271Policies[0]!
    assert.strictEqual(policy.policy, SignaturePolicy.v1.address)
    const [config] = AbiParameters.decode(AbiParameters.from(["(address[] verifiers, bytes[] types)"]), policy.initData)
    assert.deepStrictEqual(config.verifiers, [USDC])
    assert.deepStrictEqual(
      AbiParameters.decode(
        AbiParameters.from([
          "(bytes32 appDomainSeparator, bytes32 typeHash, (uint8 condition, uint256 index, bytes32[] refs)[] fields)"
        ]),
        config.types[0]!
      )[0],
      {
        appDomainSeparator: TypedData.domainSeparator(domain),
        typeHash: Hash.keccak256(Hex.fromString(contentsType)),
        fields: [
          { condition: 0, index: 1n, refs: [addressWord(merchant)] },
          { condition: 3, index: 2n, refs: [word(5n)] }
        ]
      }
    )
  })

  it("names the session key's validator, its config and the window", () => {
    const passkey = SessionKey.passkey({
      publicKey:
        "0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"
    })
    const ecdsa = compile([Policy.nativeTransfer({ to: merchant })], { validAfter: 5, sponsored: true })
    const webauthn = compile([Policy.nativeTransfer({ to: merchant })], {
      signer: passkey,
      validUntil: "never",
      unsafe: true
    })

    assert.strictEqual(ecdsa.sessionValidator, ECDSASessionValidator.v1.address)
    assert.strictEqual(ecdsa.sessionValidatorInitData, SessionKey.toValidatorData(agent))
    assert.deepStrictEqual([ecdsa.validAfter, ecdsa.validUntil, ecdsa.permitERC4337Paymaster], [5, 2_000_000_000, true])
    assert.strictEqual(webauthn.sessionValidator, WebAuthnValidator.v1.address)
    assert.strictEqual(webauthn.sessionValidatorInitData, SessionKey.toValidatorData(passkey))
    assert.strictEqual(webauthn.validUntil, 0)
  })
})
