import * as Predicate from "effect/Predicate"
import * as Result from "effect/Result"

import * as AccountError from "../accounts/AccountError.ts"
import * as ChainError from "../ChainError.ts"
import * as GrantError from "../GrantError.ts"
import * as BundlerError from "../infra/BundlerError.ts"
import * as CompatError from "../infra/CompatError.ts"
import * as PaymasterError from "../infra/PaymasterError.ts"
import * as KeystoreError from "../keys/KeystoreError.ts"
import * as SessionKeyError from "../keys/SessionKeyError.ts"
import type { NameraError } from "../NameraError.ts"
import * as PolicyViolationError from "../PolicyViolationError.ts"
import * as SerializationError from "../SerializationError.ts"
import * as SessionError from "../SessionError.ts"
import { redactUrl, redactUrls } from "./redact.ts"

// Errors as plain JSON for other processes (an EIP-1193 provider's error `data`, agent tools, workers). One table says
// which fields each family and reason has and of what kind: `toJson` writes only those, and `fromJson` refuses anything
// else. Text is written with URLs redacted. Bigints are `{ "$n": "<decimal>" }`, as in grants.
//
// A reason's `cause` (the caller's raw viem error) is reduced to `{ name, message }`: its `shortMessage`, or its
// message's first line, URLs redacted. viem's full message adds the request body (a signed user operation) and the
// URL, and its stack and fields stay behind. `fromJson` rebuilds the cause as an `Error` with that name and message, so
// `details`, which reads the cause, is the same on both sides.

/** The format version `toJson` writes and `fromJson` reads. */
const FORMAT = 1

type Kind =
  | "string"
  | "number"
  | "bigint"
  | "hex"
  | "json"
  | "strings"
  | "problems"
  | "account"
  | "store"
  | "cause"
  | ReadonlyArray<string>

/** A field's kind; a trailing `?` marks it optional. */
type Fields = { readonly [field: string]: Kind | `${Exclude<Kind, ReadonlyArray<string>>}?` }

interface Family {
  readonly fields: Fields
  readonly reasons: {
    readonly [tag: string]: { readonly fields: Fields; readonly make: (fields: never) => unknown }
  }
  readonly make: (fields: Record<string, unknown>, reasons: ReadonlyArray<unknown>) => NameraError
}

const detail = { detail: "string?" } as const
const caused = { detail: "string?", cause: "cause?" } as const
const chain = { chain: "string" } as const
const limit = { attempted: "bigint", remaining: "bigint", resetsAt: "number?" } as const
const reason = <A>(make: new(fields: never) => A, fields: Fields = {}) => ({
  fields,
  make: (input: never) => new make(input)
})

const families: { readonly [tag: string]: Family } = {
  AccountError: {
    fields: { account: "account" },
    reasons: {
      NotSupported: reason(AccountError.NotSupported, { implementation: "hex?", ...caused }),
      SessionsNotInstalled: reason(AccountError.SessionsNotInstalled, caused),
      SigningFailed: reason(AccountError.SigningFailed, caused),
      InvalidOptions: reason(AccountError.InvalidOptions, caused),
      ChainMismatch: reason(AccountError.ChainMismatch, { expected: "number", actual: "number", ...caused }),
      OwnerNotFound: reason(AccountError.OwnerNotFound, { owner: "hex", ...caused }),
      OwnerExists: reason(AccountError.OwnerExists, { owner: "hex", ...caused }),
      ThresholdUnreachable: reason(AccountError.ThresholdUnreachable, {
        threshold: "number",
        owners: "number",
        ...caused
      }),
      OperationNotSupported: reason(AccountError.OperationNotSupported, { operation: "string", ...caused })
    },
    make: (fields, [reason]) => new AccountError.AccountError({ ...fields, reason } as never)
  },
  BundlerError: {
    fields: { vendor: "string?", url: "string?" },
    reasons: {
      Rejected: reason(BundlerError.Rejected, {
        code: "number",
        aa: "string?",
        data: "hex?",
        revert: "string?",
        ...detail
      }),
      Unsupported: reason(BundlerError.Unsupported, { method: "string", ...detail }),
      Dropped: reason(BundlerError.Dropped, { hash: "hex?", ...detail })
    },
    make: (fields, [reason]) => new BundlerError.BundlerError({ ...fields, reason } as never)
  },
  ChainError: {
    fields: { method: "string?", chainId: "number?", url: "string?" },
    reasons: {
      Transport: reason(ChainError.Transport, caused),
      Rpc: reason(ChainError.Rpc, { code: "number", ...caused }),
      Reverted: reason(ChainError.Reverted, { data: "hex?", ...caused }),
      Timeout: reason(ChainError.Timeout, caused)
    },
    make: (fields, [reason]) => new ChainError.ChainError({ ...fields, reason } as never)
  },
  CompatError: {
    fields: {},
    reasons: { Incompatible: reason(CompatError.Incompatible, { problems: "problems" }) },
    make: (_, [reason]) => new CompatError.CompatError({ reason } as never)
  },
  GrantError: {
    fields: {},
    reasons: {
      Malformed: reason(GrantError.Malformed, { detail: "string" }),
      VersionUnsupported: reason(GrantError.VersionUnsupported, { version: "json" }),
      InvalidSignature: reason(GrantError.InvalidSignature, chain),
      ChainNotCovered: reason(GrantError.ChainNotCovered, chain),
      DigestMismatch: reason(GrantError.DigestMismatch, chain),
      SignerMismatch: reason(GrantError.SignerMismatch, { detail: "string" }),
      PolicyNotFound: reason(GrantError.PolicyNotFound, { index: "number" }),
      RemovalWidens: reason(GrantError.RemovalWidens, { index: "number" })
    },
    make: (_, [reason]) => new GrantError.GrantError({ reason } as never)
  },
  KeystoreError: {
    fields: { store: "store?" },
    reasons: {
      NotFound: reason(KeystoreError.NotFound, { id: "string", ...caused }),
      Locked: reason(KeystoreError.Locked, caused),
      CurveUnsupported: reason(KeystoreError.CurveUnsupported, {
        curve: ["secp256k1", "ed25519", "p256"],
        supported: "strings?",
        ...caused
      }),
      NamespaceUnsupported: reason(KeystoreError.NamespaceUnsupported, { namespace: "string", ...caused }),
      Unavailable: reason(KeystoreError.Unavailable, caused),
      InvalidDigest: reason(KeystoreError.InvalidDigest, { digest: "string", ...caused })
    },
    make: (fields, [reason]) => new KeystoreError.KeystoreError({ ...fields, reason } as never)
  },
  PaymasterError: {
    fields: { vendor: "string?", url: "string?" },
    reasons: {
      Rejected: reason(PaymasterError.Rejected, { vendor: "string", message: "string" }),
      PolicyInactive: reason(PaymasterError.PolicyInactive, detail),
      InsufficientBalance: reason(PaymasterError.InsufficientBalance, detail),
      BundlerBound: reason(PaymasterError.BundlerBound, { bundler: "hex?", ...detail })
    },
    make: (fields, [reason]) => new PaymasterError.PaymasterError({ ...fields, reason } as never)
  },
  PolicyViolationError: {
    fields: {},
    reasons: {
      CallNotAllowed: reason(PolicyViolationError.CallNotAllowed, { call: "number", to: "hex", selector: "hex" }),
      ArgumentRejected: reason(PolicyViolationError.ArgumentRejected, {
        call: "number",
        to: "hex",
        selector: "hex",
        policy: ["arguments", "approvals"]
      }),
      SpendLimitExceeded: reason(PolicyViolationError.SpendLimitExceeded, { token: "hex", ...limit }),
      ValueLimitExceeded: reason(PolicyViolationError.ValueLimitExceeded, limit),
      RateLimited: reason(PolicyViolationError.RateLimited, { remaining: "bigint", resetsAt: "number?" }),
      GasLimitExceeded: reason(PolicyViolationError.GasLimitExceeded, limit),
      SignatureNotAllowed: reason(PolicyViolationError.SignatureNotAllowed, { detail: "string" }),
      PaymasterNotAllowed: reason(PolicyViolationError.PaymasterNotAllowed),
      SessionExpired: reason(PolicyViolationError.SessionExpired, { validUntil: "number" }),
      SessionNotYetValid: reason(PolicyViolationError.SessionNotYetValid, { validAfter: "number" }),
      SessionNotEnabled: reason(PolicyViolationError.SessionNotEnabled),
      SessionRevoked: reason(PolicyViolationError.SessionRevoked)
    },
    make: (_, violations) => PolicyViolationError.make(violations as never)
  },
  SerializationError: {
    fields: {},
    reasons: {
      Malformed: reason(SerializationError.Malformed, { detail: "string" }),
      VersionUnsupported: reason(SerializationError.VersionUnsupported, { version: "json" })
    },
    make: (_, [reason]) => SerializationError.make(reason as never)
  },
  SessionError: {
    fields: {},
    reasons: { InvalidSession: reason(SessionError.InvalidSession, { problems: "problems" }) },
    make: (_, [reason]) => new SessionError.SessionError({ reason } as never)
  },
  SessionKeyError: {
    fields: {},
    reasons: {
      InvalidAddress: reason(SessionKeyError.InvalidAddress, { value: "string" }),
      InvalidPublicKey: reason(SessionKeyError.InvalidPublicKey, { value: "string" }),
      NoSigners: reason(SessionKeyError.NoSigners),
      TooManySigners: reason(SessionKeyError.TooManySigners, { signers: "number", max: "number" }),
      DuplicateSigner: reason(SessionKeyError.DuplicateSigner, { signer: "hex" }),
      InvalidThreshold: reason(SessionKeyError.InvalidThreshold, { threshold: "number", signers: "number" })
    },
    make: (_, [reason]) => new SessionKeyError.SessionKeyError({ reason } as never)
  }
}

/**
 * A Namera error as plain JSON: its family's `_tag` and fields, its reason (every violation, for a
 * `PolicyViolationError`), and viem's error fields for readers without the SDK.
 */
export interface Json {
  readonly format: 1
  readonly _tag: NameraError["_tag"]
  readonly reason: ReasonJson
  readonly violations?: ReadonlyArray<ReasonJson> | undefined
  readonly shortMessage: string
  readonly details?: string | undefined
  readonly docsPath?: string | undefined
  readonly metaMessages?: ReadonlyArray<string> | undefined
  readonly version: string
  readonly [field: string]: unknown
}

/** A reason as plain JSON: its `_tag` and fields, bigints as `{ "$n": "<decimal>" }`. */
export interface ReasonJson {
  readonly _tag: string
  readonly [field: string]: unknown
}

const viemFields = ["shortMessage", "details", "docsPath", "metaMessages", "version"]

const kindOf = (spec: Fields[string]) =>
  typeof spec === "string" && spec.endsWith("?")
    ? { kind: spec.slice(0, -1) as Kind, optional: true }
    : { kind: spec as Kind, optional: false }

const isHex = (u: unknown): u is `0x${string}` => Predicate.isString(u) && /^0x[0-9a-fA-F]*$/.test(u)
const isNumber = (u: unknown): u is number => typeof u === "number" && Number.isFinite(u)

const encode = (kind: Kind, value: unknown): unknown => {
  switch (kind) {
    case "bigint":
      return { $n: String(value) }
    case "string":
      return redactUrls(value as string)
    case "strings":
      return [...(value as ReadonlyArray<string>)]
    case "problems":
      return (value as ReadonlyArray<object>).map((problem) => ({ ...problem }))
    case "account":
    case "store":
      return { ...(value as object) }
    case "cause": {
      const error = value as Error & { readonly shortMessage?: unknown }
      const text = Predicate.isString(error.shortMessage) ? error.shortMessage : error.message.split("\n")[0]!
      return { name: error.name, message: redactUrls(text) }
    }
    default:
      return value
  }
}

const decode = (kind: Kind, value: unknown): Result.Result<unknown, string> => {
  const ok = (valid: boolean) => (valid ? Result.succeed(value) : Result.fail(`expected ${String(kind)}`))
  if (typeof kind !== "string") return ok(kind.includes(value as string))
  switch (kind) {
    case "string":
      return ok(Predicate.isString(value))
    case "number":
      return ok(isNumber(value))
    case "hex":
      return ok(isHex(value))
    case "json":
      return ok(value !== undefined)
    case "strings":
      return ok(Array.isArray(value) && value.every(Predicate.isString))
    case "bigint":
      return Predicate.isObject(value) && Object.keys(value).length === 1 && Predicate.isString(value["$n"])
          && /^-?\d+$/.test(value["$n"])
        ? Result.succeed(BigInt(value["$n"]))
        : Result.fail("expected a bigint as { \"$n\": \"<decimal>\" }")
    case "problems":
      return ok(
        Array.isArray(value) &&
          value.every((problem) =>
            Predicate.isObject(problem) && Predicate.isString(problem["code"]) && Predicate.isString(problem["message"])
            && (problem["policy"] === undefined || isNumber(problem["policy"]))
            && Object.keys(problem).every((key) => ["code", "message", "policy"].includes(key))
          )
      )
    case "account":
      return ok(
        Predicate.isObject(value) && Predicate.isString(value["type"])
          && (value["address"] === undefined || isHex(value["address"]))
          && Object.keys(value).every((key) => key === "type" || key === "address")
      )
    case "store":
      return ok(Predicate.isObject(value) && Predicate.isString(value["type"]) && Object.keys(value).length === 1)
    case "cause": {
      if (
        !Predicate.isObject(value) || !Predicate.isString(value["name"]) || !Predicate.isString(value["message"])
        || Object.keys(value).length !== 2
      ) return Result.fail("expected a cause as { name, message }")
      const cause = new Error(value["message"])
      cause.name = value["name"]
      return Result.succeed(cause)
    }
  }
}

const writeFields = (fields: Fields, source: Record<string, unknown>) => {
  const json: Record<string, unknown> = {}
  for (const [field, spec] of Object.entries(fields)) {
    const value = source[field]
    const { kind } = kindOf(spec)
    // Only an `Error` cause has a safe summary; any other value stays behind.
    if (value !== undefined && (kind !== "cause" || Predicate.isError(value))) json[field] = encode(kind, value)
  }
  return json
}

// Fields read back exactly as the table says: each present field of the right kind, nothing else.
const readFields = (
  fields: Fields,
  source: Record<string, unknown>,
  where: string,
  allowed: ReadonlyArray<string> = []
): Result.Result<Record<string, unknown>, string> => {
  const unknown = Object.keys(source).filter((key) => !(key in fields) && !allowed.includes(key))
  if (unknown.length > 0) return Result.fail(`${where} has unknown fields: ${unknown.join(", ")}`)

  const read: Record<string, unknown> = {}
  for (const [field, spec] of Object.entries(fields)) {
    const { kind, optional } = kindOf(spec)
    const value = source[field]
    if (value === undefined) {
      if (optional) continue
      return Result.fail(`${where} is missing ${field}`)
    }
    const decoded = decode(kind, value)
    if (Result.isFailure(decoded)) return Result.fail(`${where}.${field}: ${decoded.failure}`)
    read[field] = field === "url" ? redactUrl(decoded.success as string) : decoded.success
  }
  return Result.succeed(read)
}

/**
 * Writes a Namera error as plain JSON: the family's and reasons' fields from the table, never a `cause`.
 *
 * @internal
 */
export const toJson = (error: NameraError): Json => {
  const family = families[error._tag]!
  const reasons = error._tag === "PolicyViolationError" ? error.violations : [error.reason]
  const reasonJson = (reason: { readonly _tag: string }): ReasonJson => ({
    _tag: reason._tag,
    ...writeFields(family.reasons[reason._tag]?.fields ?? {}, reason as never)
  })
  const fields = writeFields(family.fields, error as never)
  // A cause-derived `details` is the summary's message, never the cause's full message.
  const first = reasonJson(reasons[0]!)
  const summary = first["cause"] as { readonly message: string } | undefined
  const details = Predicate.isError((reasons[0] as { readonly cause?: unknown }).cause)
    ? summary?.message
    : error.details
  return {
    format: FORMAT,
    _tag: error._tag,
    ...("url" in fields ? { ...fields, url: redactUrl(fields["url"] as string) } : fields),
    reason: first,
    ...(error._tag === "PolicyViolationError" ? { violations: reasons.map(reasonJson) } : {}),
    shortMessage: redactUrls(error.shortMessage),
    ...(details === undefined ? {} : { details: redactUrls(details) }),
    ...(error.docsPath === undefined ? {} : { docsPath: error.docsPath }),
    ...(error.metaMessages === undefined ? {} : { metaMessages: error.metaMessages.map(redactUrls) }),
    version: error.version
  }
}

const malformed = (detail: string) => SerializationError.make(new SerializationError.Malformed({ detail }))

const readReason = (family: Family, input: unknown, where: string): Result.Result<unknown, string> => {
  if (!Predicate.isObject(input) || !Predicate.isString(input["_tag"])) return Result.fail(`${where} has no _tag`)
  const spec = family.reasons[input["_tag"]]
  if (spec === undefined) return Result.fail(`${where} ${input["_tag"]} is not a reason of this family`)
  return Result.map(
    readFields(spec.fields, input, `${where} ${input["_tag"]}`, ["_tag"]),
    (fields) => spec.make(fields as never)
  )
}

/**
 * Rebuilds the Namera error `toJson` wrote, as an instance of its family's and reasons' classes.
 *
 * @internal
 */
export const fromJson = (input: unknown): Result.Result<NameraError, SerializationError.SerializationError> => {
  if (!Predicate.isObject(input) || Array.isArray(input)) return Result.fail(malformed("not an object"))
  if (input["format"] === undefined) return Result.fail(malformed("no format"))
  if (input["format"] !== FORMAT) {
    return Result.fail(
      SerializationError.make(new SerializationError.VersionUnsupported({ version: input["format"] }))
    )
  }
  const tag = input["_tag"]
  const family = Predicate.isString(tag) && Object.hasOwn(families, tag) ? families[tag]! : undefined
  if (family === undefined) return Result.fail(malformed(`unknown error family ${String(tag)}`))

  const violations = tag === "PolicyViolationError"
  const allowed = ["format", "_tag", "reason", ...(violations ? ["violations"] : []), ...viemFields]
  const fields = readFields(family.fields, input, String(tag), allowed)
  if (Result.isFailure(fields)) return Result.fail(malformed(fields.failure))

  const inputs = violations ? input["violations"] : [input["reason"]]
  if (!Array.isArray(inputs) || inputs.length === 0) return Result.fail(malformed(`${String(tag)} has no reasons`))
  const reasons: Array<unknown> = []
  for (const [index, reasonInput] of inputs.entries()) {
    const read = readReason(family, reasonInput, violations ? `violation ${index}` : "reason")
    if (Result.isFailure(read)) return Result.fail(malformed(read.failure))
    reasons.push(read.success)
  }
  return Result.succeed(family.make(fields.success, reasons))
}
