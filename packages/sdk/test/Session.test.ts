import { assert, describe, it } from "@effect/vitest"
import { Policy, Session, SessionError, SessionKey } from "@namera-ai/sdk"
import { Session as EffectSession } from "@namera-ai/sdk/effect"
import { Effect, Exit } from "effect"
import { TestClock } from "effect/testing"

const agent = SessionKey.ecdsa("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const merchant = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
const router = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD"
const NOW = 1_800_000_000
const salt = `0x${"11".repeat(32)}` as const

const routerAbi = [
  {
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
        { name: "amountIn", type: "uint256" },
        { name: "amountOutMinimum", type: "uint256" },
        { name: "sqrtPriceLimitX96", type: "uint160" }
      ]
    }],
    outputs: [{ name: "amountOut", type: "uint256" }]
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [{ name: "deadline", type: "uint256" }, { name: "data", type: "bytes[]" }],
    outputs: []
  },
  {
    type: "function",
    name: "sweep",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }, { name: "delta", type: "int256" }, {
      name: "ids",
      type: "uint256[2]"
    }],
    outputs: []
  },
  {
    type: "function",
    name: "pay",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: []
  },
  {
    type: "function",
    name: "pay",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: []
  }
] as const

const transfer = Policy.erc20Transfer({ token: USDC, to: [merchant], amount: { lte: 50_000000n } })

const build = (overrides: Partial<Session.from.Options> = {}) =>
  Session.from({ signer: agent, validUntil: NOW + 86400, policies: [transfer], salt, ...overrides })

const problemsOf = (thunk: () => unknown) => {
  try {
    thunk()
  } catch (error) {
    assert.isTrue(SessionError.isSessionError(error))
    return (error as SessionError.SessionError).reason.problems
  }
  return assert.fail("expected a SessionError")
}

const codesOf = (thunk: () => unknown) => problemsOf(thunk).map((problem) => problem.code)

const validation = (overrides: Partial<Session.from.Options>, account?: `0x${string}`) =>
  Session.validate(build(overrides), { now: NOW, account })

describe("Session.from", () => {
  it("sorts and deduplicates policies, so equal sessions are equal values", () => {
    const rate = Policy.rateLimit({ count: 5, period: "hour" })
    const a = build({ policies: [transfer, rate, transfer] })
    const b = build({ policies: [rate, transfer] })

    assert.deepStrictEqual(a, b)
    assert.strictEqual(a.policies.length, 2)
    assert.strictEqual(a.validAfter, 0)
    assert.isFalse(a.sponsored)
  })

  it("draws a random non-zero salt unless one is given", () => {
    const a = Session.from({ signer: agent, validUntil: NOW, policies: [transfer] })
    const b = Session.from({ signer: agent, validUntil: NOW, policies: [transfer] })

    assert.match(a.salt, /^0x[0-9a-f]{64}$/)
    assert.notStrictEqual(a.salt, b.salt)
    assert.notStrictEqual(Session.getPermissionId(a), Session.getPermissionId(b))
  })

  it("lists every malformed part at once, with the index of the policy", () => {
    const problems = problemsOf(() =>
      build({
        validAfter: -1,
        policies: [
          transfer,
          Policy.erc20Transfer({ token: "0x1234", amount: 1n }),
          Policy.spend({ token: USDC, amount: -1n, period: "day" })
        ]
      })
    )

    assert.deepStrictEqual(problems.map((problem) => [problem.code, problem.policy]), [
      ["INVALID_TIME", undefined],
      ["INVALID_ADDRESS", 1],
      ["INVALID_AMOUNT", 2]
    ])
  })

  const malformed: ReadonlyArray<readonly [string, () => unknown]> = [
    ["INVALID_ADDRESS", () => build({ policies: [Policy.nativeTransfer({ to: ["0xnope"] })] })],
    ["INVALID_AMOUNT", () => build({ policies: [transfer, Policy.rateLimit({ count: 0, period: "day" })] })],
    ["INVALID_PERIOD", () => build({ policies: [transfer, Policy.value({ amount: 1n, period: { seconds: 0 } })] })],
    [
      "INVALID_PERIOD",
      () => build({ policies: [transfer, Policy.gas({ maxCost: 1n, period: "fortnight" as never })] })
    ],
    ["INVALID_TIME", () => build({ validUntil: 0 })],
    ["INVALID_TIME", () => build({ validUntil: 2 ** 48 })],
    ["INVALID_SALT", () => build({ salt: `0x${"00".repeat(32)}` })],
    ["INVALID_SALT", () => build({ salt: "0x01" })],
    ["INVALID_SELECTOR", () => build({ policies: [Policy.call({ to: router, selector: "0x1234" })] })],
    ["INVALID_DATA", () => build({ policies: [Policy.execution({ address: router, initData: "nope" as never })] })],
    ["INVALID_DATA", () => build({ signer: { type: "rsa" } as never })],
    ["INVALID_CONDITION", () => build({ policies: [Policy.erc20Transfer({ token: USDC, amount: [] })] })],
    [
      "INVALID_CONDITION",
      () => build({ policies: [Policy.erc20Transfer({ token: USDC, amount: { between: [5n, 1n] } })] })
    ],
    [
      "INVALID_CONDITION",
      () => build({ policies: [Policy.erc20Transfer({ token: USDC, to: { lte: merchant } as never })] })
    ],
    ["INVALID_CONDITION", () => build({ policies: [Policy.nativeTransfer({ to: merchant, value: 2n ** 256n })] })],
    [
      "UNKNOWN_FUNCTION",
      () => build({ policies: [Policy.function({ address: router, abi: routerAbi, functionName: "swap" as never })] })
    ],
    [
      "AMBIGUOUS_FUNCTION",
      () => build({ policies: [Policy.function({ address: router, abi: routerAbi, functionName: "pay" })] })
    ],
    [
      "UNKNOWN_ARGUMENT",
      () =>
        build({
          policies: [
            Policy.function({
              address: router,
              abi: routerAbi,
              functionName: "exactInputSingle",
              args: { params: { recipeint: merchant } as never }
            })
          ]
        })
    ],
    [
      "DYNAMIC_ARG_CONDITION",
      () =>
        build({
          policies: [
            Policy.function({
              address: router,
              abi: routerAbi,
              functionName: "multicall",
              args: { data: ["0x"] as never }
            })
          ]
        })
    ],
    [
      "UNSUPPORTED_CONDITION",
      () =>
        build({
          policies: [
            Policy.function({ address: router, abi: routerAbi, functionName: "sweep", args: { delta: 1n } as never })
          ]
        })
    ],
    [
      "UNSUPPORTED_CONDITION",
      () =>
        build({
          policies: [
            Policy.function({ address: router, abi: routerAbi, functionName: "sweep", args: { ids: [1n] } as never })
          ]
        })
    ],
    [
      "INVALID_TYPED_DATA",
      () =>
        build({
          policies: [
            Policy.signTypedData({ domain: { verifyingContract: USDC }, types: {}, primaryType: "Permit" })
          ]
        })
    ],
    ["UNSAFE_REQUIRED", () => build({ validUntil: "never" })],
    ["UNSAFE_REQUIRED", () => build({ policies: [Policy.anyCall({ unsafe: false as true })] })]
  ]
  for (const [code, thunk] of malformed) {
    it(`refuses ${code}`, () => {
      assert.deepStrictEqual(codesOf(thunk), [code])
    })
  }

  it("names an overloaded function by its signature", () => {
    const session = build({
      policies: [
        Policy.function({
          address: router,
          abi: routerAbi,
          functionName: "pay(address,uint256)",
          args: { amount: { lte: 1n } }
        })
      ]
    })
    assert.strictEqual(Session.toSmartSession(session).actions[0]?.actionTargetSelector, "0xc4076876")
  })

  it("fails in the Effect API's error channel", async () => {
    const exit = await Effect.runPromiseExit(
      EffectSession.from({ signer: agent, validUntil: "never", policies: [transfer] })
    )
    assert.isTrue(Exit.isFailure(exit))
  })
})

describe("Session.validate", () => {
  it("accepts a well-formed session", () => {
    assert.deepStrictEqual(validation({}), { ok: true, problems: [], warnings: [] })
  })

  const errors: ReadonlyArray<readonly [string, Partial<Session.from.Options>, `0x${string}`?]> = [
    ["NO_CALL_POLICY", { policies: [Policy.rateLimit({ count: 1, period: "day" })] }],
    ["EMPTY_WINDOW", { validAfter: NOW + 86400 }],
    ["EXPIRY_IN_PAST", { validUntil: NOW - 1 }],
    [
      "CONFLICTING_LIMITS",
      {
        policies: [
          transfer,
          Policy.spend({ token: USDC, amount: 1n, period: "day" }),
          Policy.spend({ token: USDC.toLowerCase() as `0x${string}`, amount: 2n, period: "day" })
        ]
      }
    ],
    [
      "CONFLICTING_LIMITS",
      {
        policies: [
          transfer,
          Policy.rateLimit({ count: 1, period: "day" }),
          Policy.rateLimit({ count: 2, period: "hour" })
        ]
      }
    ],
    ["OVERLAPPING_CALLS", { policies: [transfer, Policy.erc20Transfer({ token: USDC, to: merchant })] }],
    ["FORBIDDEN_TARGET", { policies: [Policy.nativeTransfer({ to: "0x0000000000000000000000000000000000000000" })] }],
    [
      "CONFIG_TOO_LARGE",
      {
        signer: SessionKey.ecdsaThreshold({
          threshold: 1,
          signers: Array.from({ length: 14 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}`)
        })
      }
    ],
    ["SIGN_MESSAGE_UNSUPPORTED", { policies: [transfer, Policy.signMessage({ prefix: "Sign in" })] }],
    [
      "TOO_MANY_EXECUTION_POLICIES",
      {
        policies: [
          transfer,
          Policy.rateLimit({ count: 1, period: "day" }),
          Policy.gas({ maxCost: 1n, period: "day" }),
          ...Array.from(
            { length: 9 },
            (_, i) => Policy.execution({ address: `0x${(i + 1).toString(16).padStart(40, "0")}`, initData: "0x" })
          )
        ]
      }
    ],
    ["EXECUTION_WITHOUT_LIMITS", { policies: [transfer, Policy.execution({ address: router, initData: "0x" })] }],
    [
      "SIGNS_FOR_ACCOUNT",
      {
        policies: [
          Policy.signTypedData({
            domain: { name: "Kernel", version: "0.3.3", chainId: 1, verifyingContract: router },
            types: { Op: [{ name: "data", type: "bytes" }] },
            primaryType: "Op"
          })
        ]
      },
      router
    ]
  ]
  for (const [code, overrides, account] of errors) {
    it(`reports ${code}`, () => {
      const result = validation(overrides, account)
      assert.isFalse(result.ok)
      assert.deepStrictEqual(result.problems.map((problem) => problem.code), [code])
    })
  }

  const warnings: ReadonlyArray<readonly [string, Partial<Session.from.Options>]> = [
    ["UNRESTRICTED_ADDRESS_ARG", { policies: [Policy.erc20Transfer({ token: USDC, amount: 1n })] }],
    ["UNRESTRICTED_AMOUNT_ARG", { policies: [Policy.erc20Transfer({ token: USDC, to: merchant })] }],
    ["RAW_CALL_POLICY", { policies: [Policy.call({ to: router, selector: "0x414bf389" })] }],
    ["ANY_CALL", { policies: [Policy.anyCall({ unsafe: true })] }],
    ["LONG_SESSION", { validUntil: NOW + 91 * 86400 }],
    ["NO_EXPIRY", { validUntil: "never", unsafe: true }],
    ["SPONSORED_WITHOUT_GAS_LIMIT", { sponsored: true }]
  ]
  for (const [code, overrides] of warnings) {
    it(`warns ${code}`, () => {
      const result = validation(overrides)
      assert.isTrue(result.ok)
      assert.deepStrictEqual(result.warnings.map((warning) => warning.code), [code])
    })
  }

  it("warns for unconditioned address and amount arguments by name", () => {
    const result = validation({
      policies: [Policy.function({ address: router, abi: routerAbi, functionName: "exactInputSingle" })]
    })
    assert.deepStrictEqual(result.warnings.map((warning) => warning.message), [
      "params.tokenIn may be any address",
      "params.tokenOut may be any address",
      "params.recipient may be any address",
      "params.amountIn may be any amount",
      "params.amountOutMinimum may be any amount"
    ])
  })

  it.effect("checks against the Clock's time in the Effect API", () =>
    Effect.gen(function*() {
      yield* TestClock.setTime((NOW + 86400) * 1000)
      const result = yield* EffectSession.validate(build())
      assert.deepStrictEqual(result.problems.map((problem) => problem.code), ["EXPIRY_IN_PAST"])
    }))
})

describe("Session.describe", () => {
  it("says what the session allows, with token amounts formatted when given", () => {
    const session = build({
      validAfter: NOW,
      sponsored: true,
      policies: [
        transfer,
        Policy.spend({ token: USDC, amount: 200_000000n, period: "day" }),
        Policy.rateLimit({ count: 1, period: "hour" }),
        Policy.nativeTransfer({ to: merchant, value: { between: [1n, 10n ** 18n] } })
      ]
    })
    const lines = Session.describe(session, { tokens: { [USDC.toLowerCase()]: { symbol: "USDC", decimals: 6 } } })

    assert.deepStrictEqual(lines, [
      "Signed by the session key 0x70997970C51812dc3A010C7d01b50e0d17dc79C8.",
      "Valid from 2027-01-15T08:00:00.000Z until 2027-01-16T08:00:00.000Z.",
      "May use a paymaster to pay for gas.",
      ...session.policies.map((policy) =>
        policy.type === "erc20Transfer"
          ? `May transfer USDC (${USDC}), where to is ${merchant} and amount is at most 50 USDC.`
          : policy.type === "spend"
          ? "May spend at most 200 USDC per day (UTC), transfers and approvals counted."
          : policy.type === "rateLimit"
          ? "May send at most 1 operation per hour."
          : `May send native currency to ${merchant}, where value is from 0.000000000000000001 native to 1 native.`
      )
    ])
  })

  it("shows raw amounts without token metadata, and a session without an end", () => {
    const lines = Session.describe(build({ validUntil: "never", unsafe: true }))
    assert.strictEqual(lines[1], "Valid from now until revoked: it never expires.")
    assert.include(lines[2], `amount is at most 50000000 (raw units of ${USDC})`)
  })
})

describe("Session.now", () => {
  it.effect("returns whole seconds, rounding down", () =>
    Effect.gen(function*() {
      yield* TestClock.setTime(1_700_000_000_999)
      assert.strictEqual(yield* EffectSession.now(), 1_700_000_000)
      assert.strictEqual(yield* EffectSession.expiresIn({ days: 1, hours: 1, minutes: 1, seconds: 1 }), 1_700_090_061)
    }))

  it("reads the system clock in the Promise API", () => {
    const before = Math.floor(Date.now() / 1000)
    const now = Session.now()
    const after = Math.floor(Date.now() / 1000)

    assert.isTrue(Number.isInteger(now))
    assert.isAtLeast(now, before)
    assert.isAtMost(now, after)
  })
})
