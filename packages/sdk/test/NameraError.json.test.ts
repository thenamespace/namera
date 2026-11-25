import { assert, describe, it } from "@effect/vitest"
import {
  AccountError,
  BundlerError,
  ChainError,
  CompatError,
  GrantError,
  KeystoreError,
  NameraError,
  PaymasterError,
  PolicyViolationError,
  SerializationError,
  SessionError,
  SessionKeyError
} from "@namera-ai/sdk"
import * as EffectApi from "@namera-ai/sdk/effect"
import { Effect } from "effect"

const address = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"
const selector = "0xa9059cbb"
const account = { type: "kernel", address } as const
const store = { store: { type: "encryptedJson" } } as const
const cause = Object.assign(new Error("HTTP request failed.\n\nURL: https://rpc.example/v2/sk_0123456789abcdef"), {
  name: "HttpRequestError",
  shortMessage: "HTTP request failed."
})

const violations = [
  { _tag: "CallNotAllowed", call: 0, to: address, selector },
  { _tag: "ArgumentRejected", call: 1, to: address, selector, policy: "approvals" },
  { _tag: "SpendLimitExceeded", token: address, attempted: 10n ** 20n, remaining: 5n, resetsAt: 1_800_000_000 },
  { _tag: "ValueLimitExceeded", attempted: 2n, remaining: 1n },
  { _tag: "RateLimited", remaining: 0n, resetsAt: 1_800_000_000 },
  { _tag: "GasLimitExceeded", attempted: 3n, remaining: 2n, resetsAt: 1_800_000_000 },
  { _tag: "SignatureNotAllowed", detail: "no signing policy names this domain" },
  { _tag: "PaymasterNotAllowed" },
  { _tag: "SessionExpired", validUntil: 1_700_000_000 },
  { _tag: "SessionNotYetValid", validAfter: 1_900_000_000 },
  { _tag: "SessionNotEnabled" },
  { _tag: "SessionRevoked" }
] as const

// One error per reason of every family, with every optional field set somewhere.
const samples: ReadonlyArray<NameraError.NameraError> = [
  AccountError.notSupported({ account, implementation: address, detail: "Safe", cause }),
  AccountError.sessionsNotInstalled({ account }),
  AccountError.signingFailed({ account: { type: "unknown" }, cause }),
  AccountError.invalidOptions({ account, detail: "no chain" }),
  AccountError.chainMismatch({ account, expected: 1, actual: 8453 }),
  AccountError.ownerNotFound({ account, owner: address }),
  AccountError.ownerExists({ account, owner: address }),
  AccountError.thresholdUnreachable({ account, threshold: 3, owners: 2 }),
  AccountError.operationNotSupported({ account, operation: "removeOwner" }),
  BundlerError.rejected({ vendor: "pimlico", url: "https://api.pimlico.io/v2/8453/rpc", code: -32500, aa: "AA23" }),
  BundlerError.rejected({ code: -32521, data: "0xdeadbeef", revert: "PolicyViolation(SpendPolicy)", detail: "x" }),
  BundlerError.unsupported({ method: "eth_sendUserOperation" }),
  BundlerError.dropped({ hash: `0x${"ab".repeat(32)}` }),
  ChainError.transport({ method: "eth_call", chainId: 8453, url: "https://rpc.example/v2/sk_0123456789abcdef", cause }),
  ChainError.rpc({ code: -32601, detail: "method not found" }),
  ChainError.reverted({ data: "0x08c379a0" }),
  ChainError.timeout({ cause: "not an Error" }),
  CompatError.incompatible([{ code: "SLOW_INCLUSION", message: "slow" }, { code: "NOT_ON_CHAIN", message: "no" }]),
  GrantError.make(new GrantError.Malformed({ detail: "not JSON" })),
  GrantError.make(new GrantError.VersionUnsupported({ version: 2 })),
  GrantError.make(new GrantError.InvalidSignature({ chain: "eip155:8453" })),
  GrantError.make(new GrantError.ChainNotCovered({ chain: "eip155:1" })),
  GrantError.make(new GrantError.DigestMismatch({ chain: "eip155:10" })),
  GrantError.make(new GrantError.SignerMismatch({ detail: "fewer signers than the threshold" })),
  GrantError.make(new GrantError.PolicyNotFound({ index: 2 })),
  GrantError.make(new GrantError.RemovalWidens({ index: 0 })),
  KeystoreError.notFound({ ...store, id: "key-1" }),
  KeystoreError.locked({ ...store, cause }),
  KeystoreError.curveUnsupported({ store: { type: "webCrypto" }, curve: "ed25519", supported: ["p256"] }),
  KeystoreError.namespaceUnsupported({ namespace: "solana" }),
  KeystoreError.unavailable({ detail: "keychain locked" }),
  KeystoreError.invalidDigest({ digest: "0x12" }),
  PaymasterError.rejected({ vendor: "alchemy", message: "policy rejected the operation", url: "https://x.example" }),
  PaymasterError.policyInactive({ vendor: "pimlico" }),
  PaymasterError.insufficientBalance({ detail: "deposit 0" }),
  PaymasterError.bundlerBound({ bundler: address }),
  PolicyViolationError.make(violations),
  ...violations.map((violation) => PolicyViolationError.make([violation])),
  SerializationError.make(new SerializationError.Malformed({ detail: "not an object" })),
  SerializationError.make(new SerializationError.VersionUnsupported({ version: "x" })),
  SessionError.invalidSession([
    { code: "INVALID_ADDRESS", message: "not an address", policy: 0 },
    { code: "INVALID_PERIOD", message: "no period" }
  ]),
  ...[
    new SessionKeyError.InvalidAddress({ value: "0x12" }),
    new SessionKeyError.InvalidPublicKey({ value: "0x34" }),
    new SessionKeyError.NoSigners(),
    new SessionKeyError.TooManySigners({ signers: 17, max: 16 }),
    new SessionKeyError.DuplicateSigner({ signer: address }),
    new SessionKeyError.InvalidThreshold({ threshold: 3, signers: 2 })
  ].map((reason) => new SessionKeyError.SessionKeyError({ reason }))
]

const families = {
  AccountError,
  BundlerError,
  ChainError,
  CompatError,
  GrantError,
  KeystoreError,
  PaymasterError,
  PolicyViolationError,
  SerializationError,
  SessionError,
  SessionKeyError
} as const

const familyOf = (error: NameraError.NameraError) => families[error._tag] as unknown as Record<string, unknown>
const reasonsOf = (error: NameraError.NameraError) =>
  error._tag === "PolicyViolationError" ? error.violations : [error.reason]

/** Over the wire and back. */
const roundTrip = (error: NameraError.NameraError) =>
  NameraError.fromJSON(JSON.parse(JSON.stringify(NameraError.toJSON(error))))

const failureOf = (input: unknown) => {
  try {
    NameraError.fromJSON(input)
  } catch (error) {
    assert.isTrue(SerializationError.isSerializationError(error), String(error))
    return (error as SerializationError.SerializationError).reason
  }
  return assert.fail("expected fromJSON to throw")
}

describe("NameraError.toJSON and fromJSON", () => {
  it("cover every reason class of every family", () => {
    const sampled = new Set(
      samples.flatMap((error) => reasonsOf(error).map((reason) => `${error._tag}.${reason._tag}`))
    )
    // Every error class a family module exports besides the family itself (`XErrorReason` aliases one of them).
    const declared = new Set(
      Object.entries(families).flatMap(([family, module]) =>
        Object.values(module)
          .filter((value): value is typeof Error =>
            typeof value === "function" && value.prototype instanceof Error && value.name !== family
          )
          .map((reason) => `${family}.${reason.name}`)
      )
    )

    assert.deepStrictEqual([...sampled].sort(), [...declared].sort())
  })

  it("rebuild the same family and reason classes, with the same fields and messages", () => {
    for (const error of samples) {
      const back = roundTrip(error)
      const family = familyOf(error)[error._tag] as new(...args: never) => unknown

      assert.instanceOf(back, family, error._tag)
      assert.isTrue(NameraError.isNameraError(back))
      for (const [index, reason] of reasonsOf(back).entries()) {
        const original = reasonsOf(error)[index]!
        assert.instanceOf(reason, familyOf(error)[original._tag] as new(...args: never) => unknown, original._tag)
      }
      assert.strictEqual(back.message, error.message)
      assert.deepStrictEqual(back.metaMessages, error.metaMessages)
      assert.deepStrictEqual(NameraError.toJSON(back), NameraError.toJSON(error))
    }
  })

  it("keep bigints exact, as { $n }", () => {
    const json = NameraError.toJSON(PolicyViolationError.make([violations[2]]))
    const back = roundTrip(PolicyViolationError.make([violations[2]])) as PolicyViolationError.PolicyViolationError

    assert.deepStrictEqual(json.reason["attempted"], { $n: "100000000000000000000" })
    assert.strictEqual((back.reason as PolicyViolationError.SpendLimitExceeded).attempted, 10n ** 20n)
  })

  it("reduce a cause to its name and short message, without the URL's credentials", () => {
    const error = ChainError.transport({ url: "https://rpc.example/v2/sk_0123456789abcdef", cause })
    const json = NameraError.toJSON(error)
    const text = JSON.stringify(json)

    assert.deepStrictEqual(json.reason["cause"], { name: "HttpRequestError", message: "HTTP request failed." })
    assert.strictEqual(json.details, "HTTP request failed.")
    assert.notInclude(text, "sk_0123456789abcdef")
    const back = NameraError.fromJSON(json) as ChainError.ChainError
    assert.strictEqual((back.reason.cause as Error).name, "HttpRequestError")
  })

  it("write only the table's fields, so nothing else on an error leaves", () => {
    const error = Object.assign(ChainError.rpc({ code: 1 }), { privateKey: `0x${"11".repeat(32)}` })
    Object.assign(error.reason, { signature: `0x${"22".repeat(65)}` })

    const text = JSON.stringify(NameraError.toJSON(error))
    assert.notInclude(text, "privateKey")
    assert.notInclude(text, "signature")
  })

  it.effect("work with catchReason on the other side", () =>
    Effect.gen(function*() {
      const received = yield* EffectApi.NameraError.fromJSON(NameraError.toJSON(ChainError.rpc({ code: -32005 })))
      const code = yield* Effect.fail(received).pipe(
        Effect.catchReason("ChainError", "Rpc", (reason) => Effect.succeed(reason.code)),
        Effect.orElseSucceed(() => 0)
      )

      assert.strictEqual(code, -32005)
    }))

  it("refuse input that isn't a serialized error with SerializationError", () => {
    const json = NameraError.toJSON(ChainError.rpc({ code: -32601, method: "eth_call" }))
    const reason = json.reason

    const malformed = [
      "not an object",
      null,
      [json],
      { ...json, _tag: "TeapotError" },
      { ...json, _tag: "toString" },
      { ...json, reason: { ...reason, _tag: "Timeout2" } },
      { ...json, reason: { _tag: "Rpc" } },
      { ...json, reason: { ...reason, code: "-32601" } },
      { ...json, reason: { ...reason, extra: 1 } },
      { ...json, chainId: "1" },
      { ...json, extra: 1 },
      { ...json, reason: { ...reason, cause: { name: "Error", message: "x", stack: "at …" } } },
      { ...NameraError.toJSON(PolicyViolationError.make([violations[4]])), violations: [] },
      {
        ...NameraError.toJSON(PolicyViolationError.make([violations[4]])),
        violations: [{ ...violations[4], remaining: { $n: "1.5" } }]
      },
      { ...NameraError.toJSON(AccountError.sessionsNotInstalled({ account })), account: { type: "kernel", key: "x" } }
    ]
    for (const input of malformed) {
      assert.strictEqual(failureOf(input)._tag, "Malformed", JSON.stringify(input))
    }

    assert.deepStrictEqual(failureOf({ ...json, format: 2 }), new SerializationError.VersionUnsupported({ version: 2 }))
    assert.strictEqual(failureOf({ _tag: "ChainError" })._tag, "Malformed")
  })
})
