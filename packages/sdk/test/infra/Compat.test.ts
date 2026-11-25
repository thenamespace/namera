import { assert, describe, it } from "@effect/vitest"
import { Bundler, Compat, type CompatError, Paymaster, Policy, Session, SessionKey } from "@namera-ai/sdk"

const BASE = 8453
const BASE_SEPOLIA = 84532
const OP_SEPOLIA = 11155420
const SEPOLIA = 11155111
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const CIRCLE_BASE = "0x6C973eBe80dCD8660841D4356bf15c32460271C9"

const codes = (result: Compat.Result) => ({
  problems: result.problems.map((problem) => problem.code),
  warnings: result.warnings.map((warning) => warning.code)
})

const permit = (spender: `0x${string}`) =>
  Policy.signTypedData({
    domain: { name: "USD Coin", version: "2", chainId: BASE, verifyingContract: USDC_BASE },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    },
    primaryType: "Permit",
    message: { spender, value: { lte: 5_000000n } }
  })

const session = (...policies: ReadonlyArray<Policy.Policy>) =>
  Session.from({
    signer: SessionKey.ecdsa("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
    validUntil: 2_000_000_000,
    sponsored: true,
    policies: [Policy.nativeTransfer({ to: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" }), ...policies]
  })

describe("Compat.check", () => {
  describe("PAYMASTER_BUNDLER_BOUND", () => {
    it.each(["pimlico", "pimlico-erc20", "zerodev"] as const)(
      "refuses %s's paymaster on every bundler but Pimlico's and ZeroDev's",
      (paymaster) => {
        for (const bundler of ["candide", "alchemy", "etherspot"] as const) {
          assert.include(codes(Compat.check({ bundler, paymaster, chainId: BASE })).problems, "PAYMASTER_BUNDLER_BOUND")
        }
        for (const bundler of ["pimlico", "zerodev"] as const) {
          assert.isTrue(Compat.check({ bundler, paymaster, chainId: BASE }).ok, bundler)
        }
      }
    )

    it("warns, without refusing, when a custom bundler can't be told apart", () => {
      const result = Compat.check({
        bundler: Bundler.from({ url: "https://bundler.example" }),
        paymaster: "pimlico",
        chainId: BASE
      })

      assert.isTrue(result.ok)
      assert.deepStrictEqual(codes(result).warnings, ["PAYMASTER_BUNDLER_BOUND"])
    })

    it.each(["circle", "alchemy", "etherspot", "candide", "erc7677"] as const)(
      "accepts %s's paymaster on any bundler",
      (paymaster) => {
        for (const bundler of ["pimlico", "candide", "alchemy", "zerodev"] as const) {
          assert.isTrue(Compat.check({ bundler, paymaster, chainId: BASE }).ok, `${paymaster} on ${bundler}`)
        }
      }
    )

    it("refuses Alchemy's Gas Manager on Candide's bundler on Base Sepolia only", () => {
      assert.deepStrictEqual(
        codes(Compat.check({ bundler: "candide", paymaster: "alchemy", chainId: BASE_SEPOLIA })).problems,
        ["PAYMASTER_BUNDLER_BOUND"]
      )
      assert.isTrue(Compat.check({ bundler: "candide", paymaster: "alchemy", chainId: SEPOLIA }).ok)
    })
  })

  describe("PAYMASTER_AGENT_UNSUPPORTED", () => {
    it("refuses Arka for an agent, not for the owner", () => {
      assert.deepStrictEqual(
        codes(
          Compat.check({ account: { session: session() }, bundler: "pimlico", paymaster: "etherspot", chainId: BASE })
        )
          .problems,
        ["PAYMASTER_AGENT_UNSUPPORTED"]
      )
      assert.isTrue(Compat.check({ bundler: "pimlico", paymaster: "etherspot", chainId: BASE }).ok)
    })
  })

  describe("SPONSORSHIP_BUNDLER_BOUND", () => {
    it("binds Alchemy's sponsorship to Alchemy's bundler and UltraRelay to ZeroDev's", () => {
      assert.deepStrictEqual(
        codes(Compat.check({ bundler: "pimlico", paymaster: "alchemy-bso", chainId: BASE })).problems,
        [
          "SPONSORSHIP_BUNDLER_BOUND"
        ]
      )
      assert.deepStrictEqual(
        codes(Compat.check({ bundler: "candide", paymaster: "ultra-relay", chainId: BASE })).problems,
        [
          "SPONSORSHIP_BUNDLER_BOUND"
        ]
      )
      assert.isTrue(Compat.check({ bundler: "alchemy", paymaster: "alchemy-bso", chainId: BASE }).ok)
      assert.isTrue(Compat.check({ bundler: "zerodev", paymaster: "ultra-relay", chainId: BASE }).ok)
    })

    it("refuses a paymaster on a bundler that sponsors itself", () => {
      const bundler = Bundler.alchemy({ apiKey: "alchemy_test", sponsorship: { policyId: "policy" } })

      assert.isTrue(Compat.check({ bundler, chainId: BASE }).ok)
      assert.deepStrictEqual(
        codes(Compat.check({ bundler, paymaster: Paymaster.circle({ token: "USDC" }), chainId: BASE })).problems,
        ["SPONSORSHIP_BUNDLER_BOUND"]
      )
    })
  })

  describe("EIP7702_UNSUPPORTED and SLOW_INCLUSION", () => {
    it("refuses an EIP-7702 account on Etherspot's bundler only", () => {
      const account = { eip7702: true }

      assert.deepStrictEqual(codes(Compat.check({ account, bundler: "etherspot", chainId: BASE })).problems, [
        "EIP7702_UNSUPPORTED"
      ])
      assert.isTrue(Compat.check({ account, bundler: "pimlico", chainId: BASE }).ok)
      assert.isTrue(Compat.check({ account: { eip7702: false }, bundler: "etherspot", chainId: BASE }).ok)
    })

    it("warns that Etherspot's bundler includes operations slowly", () => {
      assert.deepStrictEqual(codes(Compat.check({ bundler: "etherspot", chainId: BASE })), {
        problems: [],
        warnings: ["SLOW_INCLUSION"]
      })
      assert.deepStrictEqual(codes(Compat.check({ bundler: "pimlico", chainId: BASE })).warnings, [])
    })
  })

  describe("SESSION_PERMIT_REQUIRED", () => {
    it("refuses Circle's paymaster for an agent whose session can't sign its permit", () => {
      const check = (agent: Session.Session) =>
        codes(Compat.check({ account: { session: agent }, bundler: "pimlico", paymaster: "circle", chainId: BASE }))

      assert.deepStrictEqual(check(session()).problems, ["SESSION_PERMIT_REQUIRED"])
      assert.deepStrictEqual(check(session(permit("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"))).problems, [
        "SESSION_PERMIT_REQUIRED"
      ])
      assert.deepStrictEqual(check(session(permit(CIRCLE_BASE))).problems, [])
    })

    it("needs the permit on the chain's USDC", () => {
      const result = Compat.check({
        account: { session: session(permit(CIRCLE_BASE)) },
        bundler: "pimlico",
        paymaster: "circle",
        chainId: BASE_SEPOLIA
      })

      assert.deepStrictEqual(codes(result).problems, ["SESSION_PERMIT_REQUIRED"])
    })

    it("asks nothing of an owner's account", () => {
      assert.isTrue(Compat.check({ bundler: "pimlico", paymaster: "circle", chainId: BASE }).ok)
    })
  })

  describe("NOT_ON_CHAIN", () => {
    it("refuses a vendor or Circle's paymaster where they aren't", () => {
      assert.deepStrictEqual(codes(Compat.check({ bundler: "alchemy", chainId: 999 })).problems, ["NOT_ON_CHAIN"])
      assert.deepStrictEqual(
        codes(Compat.check({ bundler: "pimlico", paymaster: "circle", chainId: OP_SEPOLIA })).problems,
        [
          "NOT_ON_CHAIN"
        ]
      )
      assert.isTrue(Compat.check({ bundler: "pimlico", paymaster: "circle", chainId: BASE_SEPOLIA }).ok)
      // Circle's Sepolia paymaster is deployed but unfunded.
      assert.deepStrictEqual(
        codes(Compat.check({ bundler: "pimlico", paymaster: "circle", chainId: SEPOLIA })).problems,
        ["NOT_ON_CHAIN"]
      )
    })

    it("refuses an agent where Namera's session contracts aren't, except on a local devnet", () => {
      const account = { session: session() }

      assert.deepStrictEqual(codes(Compat.check({ account, bundler: "pimlico", chainId: 1 })).problems, [
        "NOT_ON_CHAIN"
      ])
      assert.isTrue(Compat.check({ account, bundler: "pimlico", chainId: BASE }).ok)
      assert.isTrue(Compat.check({ account, bundler: "custom", chainId: 31337 }).ok)
    })
  })
})

// Every code `CompatError.Problem` can carry: `satisfies` fails to compile when one is missing or unknown.
const problemCodes = {
  PAYMASTER_BUNDLER_BOUND: true,
  PAYMASTER_AGENT_UNSUPPORTED: true,
  SPONSORSHIP_BUNDLER_BOUND: true,
  EIP7702_UNSUPPORTED: true,
  SLOW_INCLUSION: true,
  SESSION_PERMIT_REQUIRED: true,
  NOT_ON_CHAIN: true
} satisfies Record<CompatError.Problem["code"], true>

describe("Compat.matrix", () => {
  it("dates and sources every rule Compat.check reports", () => {
    const { rules, version } = Compat.matrix()

    assert.deepStrictEqual(
      rules.map((rule) => rule.code).sort(),
      Object.keys(problemCodes).sort()
    )
    for (const rule of rules) assert.match(rule.date, /^\d{4}-\d{2}-\d{2}$/, rule.code)
    assert.isTrue(rules.every((rule) => rule.source.length > 0 && rule.date <= version))
  })
})
