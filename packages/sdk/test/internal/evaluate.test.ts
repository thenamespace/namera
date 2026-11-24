import { assert, describe, it } from "@effect/vitest"
import { Policy, Session, SessionKey } from "@namera-ai/sdk"
import { domainless, nest } from "@namera-ai/sdk/internal/core/agent/erc7739"
import { evaluateOperation, gasCost, type State } from "@namera-ai/sdk/internal/core/evaluate/evaluate"
import { evaluateSignature } from "@namera-ai/sdk/internal/core/evaluate/signature"
import { counterKey, counters } from "@namera-ai/sdk/internal/core/evaluate/usage"
import { contracts } from "@namera-ai/sdk/internal/session/contracts"
import * as AbiFunction from "ox/AbiFunction"
import type * as Hex from "ox/Hex"

// The evaluator's edge cases, each as the contracts decide them (contracts/src/policies, Smart Sessions' PolicyLib).
// Agreement with the deployed contracts on generated calls is shown by Grant.differential.chain.test.ts.

const account: Hex.Hex = "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc"
const token: Hex.Hex = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
const recipient: Hex.Hex = "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65"
const router: Hex.Hex = "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad"
const NOW = BigInt(1_800_000_000)

const erc20 = {
  transfer: AbiFunction.from("function transfer(address to, uint256 amount)"),
  transferFrom: AbiFunction.from("function transferFrom(address from, address to, uint256 amount)"),
  approve: AbiFunction.from("function approve(address spender, uint256 amount)"),
  increaseAllowance: AbiFunction.from("function increaseAllowance(address spender, uint256 amount)")
}
const permit2Approve = AbiFunction.from(
  "function approve(address token, address spender, uint160 amount, uint48 expiration)"
)
const call = (to: Hex.Hex, data: Hex.Hex = "0x", value = BigInt(0)) => ({ to, value, data })
const transfer = (to: Hex.Hex, amount: bigint) => call(token, AbiFunction.encodeData(erc20.transfer, [to, amount]))

const compiledOf = (policies: ReadonlyArray<Policy.Policy>, options: { readonly sponsored?: boolean } = {}) =>
  Session.toSmartSession(Session.from({
    signer: SessionKey.ecdsa(recipient),
    validUntil: Number(NOW) + 3600,
    sponsored: options.sponsored,
    policies
  }))

const state = (overrides: Partial<State> = {}): State => ({
  time: NOW,
  enabled: true,
  revoked: false,
  usage: new Map(),
  ...overrides
})

const tags = (
  compiled: ReturnType<typeof compiledOf>,
  calls: ReadonlyArray<ReturnType<typeof call>>,
  options: {
    readonly state?: State | undefined
    readonly sponsored?: boolean | undefined
    readonly gasCost?: bigint | undefined
  } = {}
) =>
  evaluateOperation({
    compiled,
    contracts,
    account,
    operation: { calls, sponsored: options.sponsored ?? false, gasCost: options.gasCost },
    state: options.state ?? state()
  }).map((violation) => violation._tag)

describe("calls", () => {
  it("need an action of their own or the fallback, never the fallback for the account itself", () => {
    const anyCall = compiledOf([Policy.anyCall({ unsafe: true })])
    assert.deepStrictEqual(tags(anyCall, [call(router, "0x12345678"), call(recipient, "0x", BigInt(1))]), [])
    assert.deepStrictEqual(tags(anyCall, [call(account, "0x12345678")]), ["CallNotAllowed"])

    const selfCall = compiledOf([
      Policy.function({
        address: account,
        abi: [{ type: "function", name: "ping", inputs: [], outputs: [], stateMutability: "nonpayable" }],
        functionName: "ping"
      })
    ])
    assert.deepStrictEqual(tags(selfCall, [call(account, "0x5c36b186")]), [])
  })

  it("never allow a nested execute on the account, Smart Sessions or the fallback's marker", () => {
    const anyCall = compiledOf([Policy.anyCall({ unsafe: true })])
    for (const target of [account, contracts.smartSession, "0x0000000000000000000000000000000000000001" as const]) {
      assert.deepStrictEqual(tags(anyCall, [call(target, "0xe9ae5c53")]), ["CallNotAllowed"])
    }
  })

  it("check every argument rule, including the value, and count calldata too short as failing", () => {
    const compiled = compiledOf([
      Policy.erc20Transfer({ token, to: [recipient], amount: { between: [BigInt(10), BigInt(20)] } }),
      Policy.nativeTransfer({ to: [router], value: { gt: BigInt(5) } })
    ])
    assert.deepStrictEqual(tags(compiled, [transfer(recipient, BigInt(10)), call(router, "0x", BigInt(6))]), [])
    assert.deepStrictEqual(tags(compiled, [transfer(recipient, BigInt(21))]), ["ArgumentRejected"])
    assert.deepStrictEqual(tags(compiled, [transfer(router, BigInt(15))]), ["ArgumentRejected"])
    assert.deepStrictEqual(tags(compiled, [call(router, "0x", BigInt(5))]), ["ArgumentRejected"])
    assert.deepStrictEqual(tags(compiled, [call(token, "0xa9059cbb")]), ["ArgumentRejected"])
  })

  it("allow approvals of listed spenders up to the maximum, any revocation, and Permit2 for listed tokens", () => {
    const compiled = compiledOf([
      Policy.anyCall({ unsafe: true }),
      Policy.approvals({ tokens: [token], spenders: [router], maxAmount: BigInt(100) })
    ])
    const approve = (spender: Hex.Hex, amount: bigint) =>
      call(token, AbiFunction.encodeData(erc20.approve, [spender, amount]))
    const permit2 = (approved: Hex.Hex, amount: bigint) =>
      call(
        "0x000000000022D473030F116dDEE9F6B43aC78BA3",
        AbiFunction.encodeData(permit2Approve, [approved, router, amount, 0])
      )
    assert.deepStrictEqual(tags(compiled, [approve(router, BigInt(100)), approve(recipient, BigInt(0))]), [])
    assert.deepStrictEqual(tags(compiled, [approve(router, BigInt(101))]), ["ArgumentRejected"])
    assert.deepStrictEqual(tags(compiled, [approve(recipient, BigInt(1))]), ["ArgumentRejected"])
    assert.deepStrictEqual(tags(compiled, [permit2(token, BigInt(5))]), [])
    assert.deepStrictEqual(tags(compiled, [permit2(recipient, BigInt(5))]), ["ArgumentRejected"])
  })

  // Internal review, findings 13 and 14 and the target and value leads, as ApprovalPolicy decides them.
  it("refuse increaseAllowance, other tokens, value, and approvals past each token's own cap", () => {
    const dai: Hex.Hex = "0x6b175474e89094c44da98b954eedeac495271d0f"
    const compiled = compiledOf([
      Policy.anyCall({ unsafe: true }),
      Policy.approvals({
        tokens: [token, dai],
        spenders: [router],
        maxAmount: { [token]: BigInt(5), [dai]: BigInt(500) }
      })
    ])
    const approveOn = (target: Hex.Hex, amount: bigint, value = BigInt(0)) =>
      call(target, AbiFunction.encodeData(erc20.approve, [router, amount]), value)
    assert.deepStrictEqual(tags(compiled, [approveOn(token, BigInt(5)), approveOn(dai, BigInt(500))]), [])
    assert.deepStrictEqual(tags(compiled, [approveOn(token, BigInt(6))]), ["ArgumentRejected"])
    assert.deepStrictEqual(tags(compiled, [approveOn(token, BigInt(1), BigInt(1))]), ["ArgumentRejected"])
    assert.deepStrictEqual(
      tags(compiled, [call(token, AbiFunction.encodeData(erc20.increaseAllowance, [router, BigInt(1)]))]),
      ["ArgumentRejected"]
    )
  })

  // Internal review, finding 1 and the value-selector lead: the fallback never reaches the EntryPoint, and only empty
  // calldata is a plain value transfer.
  it("refuse the EntryPoint through the fallback, and calldata that isn't empty under the value selector", () => {
    const compiled = compiledOf([Policy.anyCall({ unsafe: true }), Policy.nativeTransfer({ to: [router] })])
    assert.deepStrictEqual(tags(compiled, [call("0x0000000071727De22E5E9d8BAf0edAc6f37da032", "0x205c2878")]), [
      "CallNotAllowed"
    ])
    assert.deepStrictEqual(tags(compiled, [call(router, "0x", BigInt(1))]), [])
    assert.deepStrictEqual(tags(compiled, [call(router, "0x01", BigInt(1))]), ["CallNotAllowed"])
    assert.deepStrictEqual(tags(compiled, [call(router, "0xffffffff00", BigInt(1))]), ["CallNotAllowed"])
  })
})

describe("limits", () => {
  it("count transfers, transferFrom and approvals against a spend budget, with what has been used", () => {
    const compiled = compiledOf([
      Policy.anyCall({ unsafe: true }),
      Policy.spend({ token, amount: BigInt(100), period: "day" })
    ])
    const [counter] = counters(compiled, contracts)
    const used = state({ usage: new Map([[counterKey(counter!), BigInt(60)]]) })
    const transferFrom = call(token, AbiFunction.encodeData(erc20.transferFrom, [account, recipient, BigInt(20)]))
    const approve = call(token, AbiFunction.encodeData(erc20.approve, [router, BigInt(20)]))

    assert.deepStrictEqual(tags(compiled, [transferFrom, approve], { state: used }), [])
    const [violation] = evaluateOperation({
      compiled,
      contracts,
      account,
      operation: { calls: [transferFrom, approve, transfer(recipient, BigInt(1))], sponsored: false },
      state: used
    })
    assert.deepStrictEqual(violation, {
      _tag: "SpendLimitExceeded",
      token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      attempted: BigInt(41),
      remaining: BigInt(40),
      resetsAt: (Math.floor(Number(NOW) / 86400) + 1) * 86400
    })
    // A transfer too short to hold its amount counts as unlimited.
    assert.deepStrictEqual(tags(compiled, [call(token, "0xa9059cbb")]), ["SpendLimitExceeded"])
  })

  // Internal review, findings 4 and 5, as SpendPolicy decides them.
  it("count Permit2 approvals of the token, and any other function of the token as unlimited", () => {
    const compiled = compiledOf([
      Policy.anyCall({ unsafe: true }),
      Policy.spend({ token, amount: BigInt(100), period: "lifetime" })
    ])
    const permit2 = (approved: Hex.Hex, amount: bigint) =>
      call(
        "0x000000000022D473030F116dDEE9F6B43aC78BA3",
        AbiFunction.encodeData(permit2Approve, [approved, router, amount, 0])
      )
    assert.deepStrictEqual(tags(compiled, [permit2(token, BigInt(100))]), [])
    assert.deepStrictEqual(tags(compiled, [permit2(token, BigInt(101))]), ["SpendLimitExceeded"])
    assert.deepStrictEqual(tags(compiled, [permit2(recipient, BigInt(101))]), [])
    // `transferAndCall(address,uint256,bytes)`: the policy can't tell what it moves.
    assert.deepStrictEqual(tags(compiled, [call(token, "0x4000aea0")]), ["SpendLimitExceeded"])
    assert.deepStrictEqual(tags(compiled, [call(token, "0x", BigInt(1))]), [])
  })

  it("count operations against a rate limit and the worst-case gas against a gas budget", () => {
    const compiled = compiledOf([
      Policy.anyCall({ unsafe: true }),
      Policy.rateLimit({ count: 2, period: "hour" }),
      Policy.gas({ maxCost: BigInt(1000), period: "lifetime" })
    ])
    const [rate, gas] = counters(compiled, contracts)
    const full = state({ usage: new Map([[counterKey(rate!), BigInt(2)], [counterKey(gas!), BigInt(900)]]) })
    assert.deepStrictEqual(tags(compiled, [call(router)], { state: full, gasCost: BigInt(100) }), ["RateLimited"])
    assert.deepStrictEqual(tags(compiled, [call(router)], { state: full, gasCost: BigInt(101) }), [
      "RateLimited",
      "GasLimitExceeded"
    ])
    // Without the operation's gas (a dry run), the gas budget isn't charged.
    assert.deepStrictEqual(tags(compiled, [call(router)], { gasCost: undefined }), [])
    assert.strictEqual(
      gasCost({
        callGasLimit: BigInt(1),
        verificationGasLimit: BigInt(2),
        preVerificationGas: BigInt(3),
        paymaster: router,
        paymasterVerificationGasLimit: BigInt(4),
        paymasterPostOpGasLimit: BigInt(5),
        maxFeePerGas: BigInt(10)
      }),
      BigInt(150)
    )
  })
})

describe("the session", () => {
  it("refuses outside its window, once revoked, and a paymaster it doesn't allow", () => {
    const compiled = compiledOf([Policy.anyCall({ unsafe: true }), Policy.rateLimit({ count: 9, period: "day" })])
    assert.deepStrictEqual(tags(compiled, [call(router)], { state: state({ time: NOW + BigInt(3601) }) }), [
      "SessionExpired"
    ])
    assert.deepStrictEqual(tags(compiled, [call(router)], { state: state({ time: NOW + BigInt(3600) }) }), [])
    assert.deepStrictEqual(tags(compiled, [call(router)], { state: state({ enabled: false, revoked: true }) }), [
      "SessionRevoked"
    ])
    assert.deepStrictEqual(tags(compiled, [call(router)], { sponsored: true }), ["PaymasterNotAllowed"])
    const sponsored = compiledOf([Policy.anyCall({ unsafe: true }), Policy.rateLimit({ count: 9, period: "day" })], {
      sponsored: true
    })
    assert.deepStrictEqual(tags(sponsored, [call(router)], { sponsored: true }), [])
  })
})

describe("signatures", () => {
  const domain = { name: "Token", version: "1", chainId: 1, verifyingContract: token } as const
  const types = { Permit: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }] } as const
  const permit = (value: bigint, primaryType = "Permit") =>
    nest({ domain, types, primaryType, message: { spender: router, value } }, domainless(1, account))
  const compiled = compiledOf([
    Policy.anyCall({ unsafe: true }),
    Policy.signTypedData({ domain, types, primaryType: "Permit", message: { value: { lte: BigInt(10) } } })
  ])
  const tagsOf = (nested: ReturnType<typeof permit>, options: { verifier?: Hex.Hex; state?: State } = {}) =>
    evaluateSignature({
      compiled,
      contracts,
      nested,
      verifier: options.verifier ?? token,
      state: options.state ?? state()
    }).map((violation) => violation._tag)

  it("allow typed data the signing policy allows, from its verifying contract", () => {
    assert.deepStrictEqual(tagsOf(permit(BigInt(10))), [])
    assert.deepStrictEqual(tagsOf(permit(BigInt(11))), ["SignatureNotAllowed"])
    assert.deepStrictEqual(tagsOf(permit(BigInt(1)), { verifier: router }), ["SignatureNotAllowed"])
    const otherApp = nest({
      domain: { ...domain, name: "Other" },
      types,
      primaryType: "Permit",
      message: { spender: router, value: BigInt(1) }
    }, domainless(1, account))
    assert.deepStrictEqual(tagsOf(otherApp), ["SignatureNotAllowed"])
  })

  it("need the session enabled and within its window", () => {
    assert.deepStrictEqual(tagsOf(permit(BigInt(1)), { state: state({ enabled: false }) }), ["SessionNotEnabled"])
    assert.deepStrictEqual(tagsOf(permit(BigInt(1)), { state: state({ time: NOW + BigInt(3601) }) }), [
      "SessionExpired"
    ])
  })
})
