import * as Result from "effect/Result"

import * as GrantError from "../../GrantError.ts"
import * as core from "../core/grant/grant.ts"
import { permissionId } from "../core/session/compile.ts"
import * as session from "../core/session/session.ts"
import * as sessionKey from "../core/sessionKey.ts"

// The grant's shape, checked by hand rather than with Effect Schema, whose runtime would ride in every app that parses
// grants (017b). It is strict: unknown fields are refused, so nothing unexpected such as a key rides along. The
// session is then rebuilt by `Session.from` and checked against the grant's id. `test/internal/grant/parse.test.ts`
// checks that it accepts and refuses what the Schema decoder it replaced did.

/** Checks a value at `path`, returning what is wrong with it, if anything. */
type Check = (value: unknown, path: string) => string | undefined

const pattern = (regex: RegExp, what: string): Check => (value, path) =>
  typeof value === "string" && regex.test(value) ? undefined : `${path}: expected ${what}`

const literal = (expected: string | number): Check => (value, path) =>
  value === expected ? undefined : `${path}: expected ${JSON.stringify(expected)}`

const typeOf = (type: "string" | "number" | "boolean" | "bigint"): Check => (value, path) =>
  typeof value === type ? undefined : `${path}: expected a ${type}`

const anyOf = (...checks: ReadonlyArray<Check>): Check => (value, path) =>
  checks.some((check) => check(value, path) === undefined) ? undefined : `${path}: unexpected value`

const array = (item: Check, options: { readonly nonEmpty?: boolean } = {}): Check => (value, path) => {
  if (!Array.isArray(value)) return `${path}: expected an array`
  if (options.nonEmpty === true && value.length === 0) return `${path}: expected at least one entry`
  for (let index = 0; index < value.length; index++) {
    const problem = item(value[index], `${path}[${index}]`)
    if (problem !== undefined) return problem
  }
  return undefined
}

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** An object with exactly these fields; the `optional` ones may be absent, but not `undefined`. */
const struct = (fields: Record<string, Check>, optional: ReadonlyArray<string> = []): Check => (value, path) => {
  if (!isRecord(value)) return `${path}: expected an object`
  for (const key of Reflect.ownKeys(value)) {
    if (
      Object.prototype.propertyIsEnumerable.call(value, key) && !(typeof key === "string" && Object.hasOwn(fields, key))
    ) {
      return `${path}.${String(key)}: unexpected field`
    }
  }
  for (const [key, check] of Object.entries(fields)) {
    if (!Object.hasOwn(value, key)) {
      if (optional.includes(key)) continue
      return `${path}.${key}: missing`
    }
    const problem = check(value[key], `${path}.${key}`)
    if (problem !== undefined) return problem
  }
  return undefined
}

const Hex = pattern(/^0x[0-9a-fA-F]*$/, "hex")
const Address = pattern(/^0x[0-9a-fA-F]{40}$/, "an address")
const Bytes32 = pattern(/^0x[0-9a-fA-F]{64}$/, "32 bytes of hex")

const contracts = [
  "smartSession",
  "ecdsaSessionValidator",
  "webAuthnValidator",
  "sessionHook",
  "allowPolicy",
  "argPolicy",
  "spendPolicy",
  "valuePolicy",
  "rateLimitPolicy",
  "gasPolicy",
  "approvalPolicy",
  "signaturePolicy"
] as const satisfies ReadonlyArray<keyof core.GrantChain["contracts"]>

// The session key's shape; `signerProblem` then checks it as `SessionKey` would build it.
const Signer = anyOf(
  struct({ type: literal("ecdsa"), threshold: typeOf("number"), signers: array(typeOf("string")) }),
  struct({
    type: literal("passkey"),
    threshold: typeOf("number"),
    passkeys: array(struct({ publicKey: typeOf("string"), requireUserVerification: typeOf("boolean") }))
  })
)

const Grant = struct({
  version: literal(1),
  namespace: literal("eip155"),
  id: Bytes32,
  account: pattern(/^eip155:[1-9]\d*:0x[0-9a-fA-F]{40}$/, "a CAIP-10 account"),
  accountType: struct({
    type: literal("kernel"),
    version: typeOf("string"),
    deployment: struct({ factory: Address, factoryData: Hex })
  }, ["deployment"]),
  session: struct({
    signer: Signer,
    policies: array(() => undefined),
    validAfter: typeOf("number"),
    validUntil: anyOf(typeOf("number"), literal("never")),
    salt: Bytes32,
    sponsored: typeOf("boolean"),
    unsafe: typeOf("boolean"),
    label: typeOf("string")
  }, ["label"]),
  chains: array(
    struct({
      chain: pattern(/^eip155:[1-9]\d*$/, "a CAIP-2 chain"),
      contracts: struct(Object.fromEntries(contracts.map((name) => [name, Address]))),
      nonce: typeOf("bigint"),
      sessionDigest: Bytes32,
      signature: Hex
    }),
    { nonEmpty: true }
  ),
  summary: array(typeOf("string"))
})

const signerProblem = (signer: core.Grant["session"]["signer"]): string | undefined => {
  const built = signer.type === "ecdsa"
    ? sessionKey.ecdsa(signer.threshold, signer.signers)
    : sessionKey.passkey(signer.threshold, signer.passkeys)
  return "problem" in built ? `its session key is invalid (${built.problem._tag})` : undefined
}

const malformed = (detail: string) => Result.fail(GrantError.make(new GrantError.Malformed({ detail })))

/**
 * Reads a grant from its JSON, its token, or the value itself, checking everything but the signatures and digests
 * (`Grant.verify` checks those).
 *
 * @internal
 */
export const parse = (input: unknown): Result.Result<core.Grant, GrantError.GrantError> => {
  let value: unknown = input
  if (typeof input === "string") {
    const text = input.trim()
    const json = text.startsWith(core.TOKEN_PREFIX) ? core.tokenJson(text) : text
    if (json === undefined) return malformed("the token is not valid base64url")
    try {
      value = core.fromJson(json)
    } catch {
      return malformed("expected JSON or a grant token")
    }
  }

  const version = (value as { readonly version?: unknown } | null)?.version
  if (typeof value === "object" && value !== null && version !== 1) {
    return Result.fail(GrantError.make(new GrantError.VersionUnsupported({ version })))
  }
  const problem = Grant(value, "grant")
  if (problem !== undefined) return malformed(problem)
  const grant = value as core.Grant
  const invalidSigner = signerProblem(grant.session.signer)
  if (invalidSigner !== undefined) return malformed(invalidSigner)

  // The session and its id are rebuilt from untrusted data: anything they throw is the grant's fault, not a defect.
  try {
    const rebuilt = session.make(grant.session)
    if ("problems" in rebuilt) {
      return malformed(`its session is invalid: ${rebuilt.problems.map((entry) => entry.message).join("; ")}`)
    }
    for (const chain of grant.chains) {
      if (permissionId(rebuilt.session, chain.contracts) !== grant.id.toLowerCase()) {
        return malformed(`its id is not its session's permission id on ${chain.chain}`)
      }
    }
    return Result.succeed({ ...grant, session: rebuilt.session })
  } catch (cause) {
    return malformed(`its session can't be rebuilt: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}
