import * as Result from "effect/Result"
import * as Schema from "effect/Schema"

import * as GrantError from "../../GrantError.ts"
import * as core from "../core/grant/grant.ts"
import { permissionId } from "../core/session/compile.ts"
import * as session from "../core/session/session.ts"
import * as sessionKey from "../core/sessionKey.ts"

// The grant's schema: strict (unknown fields are refused, so nothing unexpected such as a key rides along), with the
// session re-normalised by `Session.from` and checked against the grant's id.

const Hex = Schema.String.check(Schema.isPattern(/^0x[0-9a-fA-F]*$/))
const Address = Schema.String.check(Schema.isPattern(/^0x[0-9a-fA-F]{40}$/))
const Bytes32 = Schema.String.check(Schema.isPattern(/^0x[0-9a-fA-F]{64}$/))
const Chain = Schema.String.check(Schema.isPattern(/^eip155:[1-9]\d*$/))

const Contracts = Schema.Struct({
  smartSession: Address,
  ecdsaSessionValidator: Address,
  webAuthnValidator: Address,
  sessionHook: Address,
  allowPolicy: Address,
  argPolicy: Address,
  spendPolicy: Address,
  valuePolicy: Address,
  rateLimitPolicy: Address,
  gasPolicy: Address,
  approvalPolicy: Address,
  signaturePolicy: Address
})

// The session key's shape; `signerProblem` then checks it as `SessionKey` would build it.
const Signer = Schema.Union([
  Schema.Struct({ type: Schema.Literal("ecdsa"), threshold: Schema.Number, signers: Schema.Array(Schema.String) }),
  Schema.Struct({
    type: Schema.Literal("passkey"),
    threshold: Schema.Number,
    passkeys: Schema.Array(Schema.Struct({ publicKey: Schema.String, requireUserVerification: Schema.Boolean }))
  })
])

const GrantSchema = Schema.Struct({
  version: Schema.Literal(1),
  namespace: Schema.Literal("eip155"),
  id: Bytes32,
  account: Schema.String.check(Schema.isPattern(/^eip155:[1-9]\d*:0x[0-9a-fA-F]{40}$/)),
  accountType: Schema.Struct({
    type: Schema.Literal("kernel"),
    version: Schema.String,
    deployment: Schema.optionalKey(Schema.Struct({ factory: Address, factoryData: Hex }))
  }),
  session: Schema.Struct({
    signer: Signer,
    policies: Schema.Array(Schema.Unknown),
    validAfter: Schema.Number,
    validUntil: Schema.Union([Schema.Number, Schema.Literal("never")]),
    salt: Bytes32,
    sponsored: Schema.Boolean,
    unsafe: Schema.Boolean,
    label: Schema.optionalKey(Schema.String)
  }),
  chains: Schema.NonEmptyArray(Schema.Struct({
    chain: Chain,
    contracts: Contracts,
    nonce: Schema.BigInt,
    sessionDigest: Bytes32,
    signature: Hex
  })),
  summary: Schema.Array(Schema.String)
})

const decode = Schema.decodeUnknownResult(GrantSchema, { onExcessProperty: "error" })

const signerProblem = (signer: typeof Signer.Type): string | undefined => {
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
  const decoded = decode(value)
  if (Result.isFailure(decoded)) return malformed(decoded.failure.message)
  const grant = decoded.success
  const invalidSigner = signerProblem(grant.session.signer)
  if (invalidSigner !== undefined) return malformed(invalidSigner)

  // The session and its id are rebuilt from untrusted data: anything they throw is the grant's fault, not a defect.
  try {
    const rebuilt = session.make(grant.session as session.Options)
    if ("problems" in rebuilt) {
      return malformed(`its session is invalid: ${rebuilt.problems.map((problem) => problem.message).join("; ")}`)
    }
    for (const chain of grant.chains) {
      if (permissionId(rebuilt.session, chain.contracts as core.GrantChain["contracts"]) !== grant.id.toLowerCase()) {
        return malformed(`its id is not its session's permission id on ${chain.chain}`)
      }
    }
    return Result.succeed({ ...(grant as unknown as core.Grant), session: rebuilt.session })
  } catch (cause) {
    return malformed(`its session can't be rebuilt: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}
