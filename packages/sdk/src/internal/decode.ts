import * as SessionHook from "@namera-ai/contracts/SessionHook"
import * as SmartSession from "@namera-ai/contracts/SmartSession"
import * as Predicate from "effect/Predicate"
import * as AbiError from "ox/AbiError"
import * as AbiParameters from "ox/AbiParameters"
import * as Hex from "ox/Hex"

import * as BundlerError from "../infra/BundlerError.ts"
import * as CompatError from "../infra/CompatError.ts"
import * as PaymasterError from "../infra/PaymasterError.ts"
import type { NameraError } from "../NameraError.ts"
import * as PolicyViolationError from "../PolicyViolationError.ts"
import { isNameraError } from "./nameraError.ts"
import { redactUrls } from "./redact.ts"
import { contracts } from "./session/contracts.ts"

// Bundler and paymaster failures, read from viem's error chain or a JSON-RPC error, decoded into Namera's errors.
// Vendors report the same failure differently (captured on Base Sepolia, 2026-11-15): revert data as hex after the
// EntryPoint code, as JSON (`"revertData":"0x…"`), as a Python bytes literal (Candide), or not at all (Alchemy).

/**
 * A failure as decoding reads it: the JSON-RPC code, the messages (URLs redacted), the revert data found in
 * structured fields, the request's method and endpoint, and the operation hash of a receipt that never came.
 *
 * @internal
 */
export interface Failure {
  readonly code?: number | undefined
  readonly text: string
  readonly data: ReadonlyArray<Hex.Hex>
  readonly method?: string | undefined
  readonly url?: string | undefined
  readonly timeoutHash?: Hex.Hex | undefined
  /** The request timed out (viem's `TimeoutError`). */
  readonly timedOut?: boolean | undefined
}

/**
 * Which side the request went to, and the vendor, when the endpoint or the caller says.
 *
 * @internal
 */
export interface Origin {
  readonly side?: "bundler" | "paymaster" | undefined
  readonly vendor?: string | undefined
}

const hosts: ReadonlyArray<readonly [RegExp, string]> = [
  [/(^|\.)pimlico\.io$/, "pimlico"],
  [/(^|\.)candide\.dev$/, "candide"],
  [/\.alchemy\.com$/, "alchemy"],
  [/(^|\.)zerodev\.app$/, "zerodev"],
  [/(^|\.)etherspot\.io$/, "etherspot"]
]

/**
 * The vendor serving an endpoint, from its host.
 *
 * @internal
 */
export const vendorOf = (url: string | undefined): string | undefined => {
  if (url === undefined) return undefined
  try {
    const { hostname } = new URL(url)
    return hosts.find(([pattern]) => pattern.test(hostname))?.[1]
  } catch {
    return undefined
  }
}

// A vendor's endpoint is a bundler's unless the method or path is a paymaster's; any other endpoint may be a node.
const sideOf = (failure: Failure, origin: Origin, vendor: string | undefined): "bundler" | "paymaster" | undefined => {
  if (origin.side !== undefined) return origin.side
  if (failure.method?.startsWith("pm_") === true) return "paymaster"
  if (failure.url?.includes("/paymaster") === true) return "paymaster"
  return vendor === undefined ? undefined : "bundler"
}

const isHex = (u: unknown): u is Hex.Hex => Predicate.isString(u) && /^0x[0-9a-fA-F]*$/.test(u)

// `b'U\xd3\xabF…'`: Candide prints revert data as a Python bytes literal.
const pythonBytes = (text: string): ReadonlyArray<Hex.Hex> =>
  [...text.matchAll(/b'((?:[^'\\]|\\.)*)'/g)].map(([, body]) => {
    const bytes: Array<number> = []
    const escapes: Record<string, number> = { t: 9, n: 10, r: 13, "\\": 92, "'": 39, "\"": 34 }
    for (let index = 0; index < body!.length; index++) {
      const char = body![index]!
      if (char !== "\\") {
        bytes.push(char.charCodeAt(0))
        continue
      }
      const next = body![index + 1]!
      if (next === "x") {
        bytes.push(Number.parseInt(body!.slice(index + 2, index + 4), 16))
        index += 3
      } else {
        bytes.push(escapes[next] ?? next.charCodeAt(0))
        index += 1
      }
    }
    return Hex.fromBytes(Uint8Array.from(bytes))
  })

const hexIn = (text: string): ReadonlyArray<Hex.Hex> =>
  [...text.matchAll(/0x[0-9a-fA-F]{8,}/g)].map(([match]) => match as Hex.Hex)

const causes = function*(error: unknown): Generator<unknown> {
  let current = error
  for (let depth = 0; depth < 16 && current !== undefined && current !== null; depth++) {
    yield current
    current = Predicate.hasProperty(current, "cause") ? current.cause : undefined
  }
}

const field = <A>(error: unknown, key: string, guard: (u: unknown) => u is A): A | undefined =>
  Predicate.hasProperty(error, key) && guard(error[key]) ? error[key] : undefined

const methodIn = (meta: ReadonlyArray<string> | undefined): string | undefined => {
  for (const line of meta ?? []) {
    const match = /^Request body: .*?"method":"([\w-]+)"/.exec(line)
    if (match !== null) return match[1]
  }
  return undefined
}

/**
 * Reads a failure from an error thrown by viem (or any error with viem's fields), walking its causes.
 *
 * @internal
 */
export const describe = (error: unknown): Failure => {
  const texts: Array<string> = []
  const data: Array<Hex.Hex> = []
  let code: number | undefined
  let method: string | undefined
  let url: string | undefined
  let timeoutHash: Hex.Hex | undefined
  let timedOut = false

  for (const cause of causes(error)) {
    // `details` and `shortMessage` are the bundler's words; `message` also lists the request, whose hex would read as
    // revert data, so it is read only from plain errors without them.
    const own = field(cause, "details", Predicate.isString) ?? field(cause, "shortMessage", Predicate.isString)
      ?? field(cause, "message", Predicate.isString)
    if (own !== undefined && !texts.includes(own)) texts.push(own)
    code ??= field(cause, "code", Number.isInteger as (u: unknown) => u is number)
    url ??= field(cause, "url", Predicate.isString)
    method ??= methodIn(field(cause, "metaMessages", Array.isArray as (u: unknown) => u is ReadonlyArray<string>))

    const raw = Predicate.hasProperty(cause, "data") ? cause.data : undefined
    if (isHex(raw)) data.push(raw)
    const nested = field(raw, "revertData", isHex) ?? field(raw, "data", isHex)
    if (nested !== undefined) data.push(nested)

    const name = field(cause, "name", Predicate.isString)
    if (name === "WaitForUserOperationReceiptTimeoutError") timeoutHash = hexIn(own ?? "")[0]
    if (name === "TimeoutError") timedOut = true
  }

  return { code, text: redactUrls(texts.join(" | ")), data, method, url, timeoutHash, timedOut }
}

// The revert errors decoding knows: Smart Sessions' and SessionHook's (from their ABIs), and the bundler allowlists of
// Pimlico's singleton paymaster (`0x7777…834C`), which also backs ZeroDev's sponsorship, and of Alchemy's Gas Manager
// paymaster, which names the bundler's sender (Candide's executor, Base Sepolia, 2026-11-25).
const bundlerNotAllowed = AbiError.from("error BundlerNotAllowed(address bundler)")
const senderNotAllowed = AbiError.from("error SenderNotAllowed(address sender)")
const known = [
  bundlerNotAllowed,
  senderNotAllowed,
  ...SmartSession.errorsV1.map((item) => AbiError.from(item)),
  ...SessionHook.errorsV1.map((item) => AbiError.from(item))
]
const bySelector = new Map(known.map((error) => [AbiError.getSelector(error), error] as const))

const policyNames: ReadonlyArray<readonly [string, string]> = [
  [contracts.allowPolicy, "AllowPolicy"],
  [contracts.argPolicy, "ArgPolicy"],
  [contracts.spendPolicy, "SpendPolicy"],
  [contracts.valuePolicy, "ValuePolicy"],
  [contracts.rateLimitPolicy, "RateLimitPolicy"],
  [contracts.gasPolicy, "GasPolicy"],
  [contracts.approvalPolicy, "ApprovalPolicy"],
  [contracts.signaturePolicy, "SignaturePolicy"]
]
const policyName = (address: string) =>
  policyNames.find(([policy]) => policy.toLowerCase() === address.toLowerCase())?.[1] ?? address

interface Revert {
  readonly data: Hex.Hex
  readonly error: AbiError.AbiError
  readonly args: ReadonlyArray<unknown>
  /** Whether the arguments decoded: vendors also print a revert's selector alone, before its data. */
  readonly complete: boolean
}

const decodeRevert = (data: Hex.Hex): Revert | undefined => {
  if (Hex.size(data) < 4) return undefined
  const error = bySelector.get(Hex.slice(data, 0, 4).toLowerCase() as Hex.Hex)
  if (error === undefined) return undefined
  try {
    // `AbiError.decode` without its unwrapping of a single argument, and with addresses checksummed for the errors.
    const args: ReadonlyArray<unknown> = AbiParameters.decode(error.inputs, Hex.slice(data, 4), {
      checksumAddress: true
    })
    return { data, error, args, complete: true }
  } catch {
    // Candide cuts the address argument to 20 bytes.
    return (error === bundlerNotAllowed || error === senderNotAllowed) && Hex.size(data) >= 24
      ? { data, error, args: [Hex.slice(data, 4, 24)], complete: true }
      : { data, error, args: [], complete: false }
  }
}

const aaCode = (text: string): string | undefined => /\b(AA\d{2})\b/.exec(text)?.[1]

const revertOf = (failure: Failure): Revert | undefined => {
  const candidates = [...failure.data, ...hexIn(failure.text), ...pythonBytes(failure.text)]
  const reverts = candidates.flatMap((candidate) => decodeRevert(candidate) ?? [])
  return reverts.find((revert) => revert.complete) ?? reverts[0]
}

// Unknown revert data: a structured field, or the longest hex after the EntryPoint code (`AA23 reverted 0x…`; Alchemy
// also prints the selector alone first).
const rawRevertData = (failure: Failure): Hex.Hex | undefined => {
  if (failure.data[0] !== undefined) return failure.data[0]
  const after = /\bAA\d{2}\b([\s\S]*)/.exec(failure.text)?.[1] ?? ""
  return hexIn(after).reduce<Hex.Hex | undefined>(
    (longest, hex) => (longest === undefined || hex.length > longest.length ? hex : longest),
    undefined
  )
}

const fromRevert = (
  revert: Revert,
  failure: Failure,
  options: BundlerError.Options
): NameraError => {
  const name = revert.error.name
  if (revert.error === bundlerNotAllowed || revert.error === senderNotAllowed) {
    const bundler = revert.args[0]
    return PaymasterError.bundlerBound({
      ...options,
      vendor: undefined,
      ...(isHex(bundler) ? { bundler } : {}),
      detail: failure.text
    })
  }
  if (name === "PaymasterValidationNotEnabled") return PolicyViolationError.make([{ _tag: "PaymasterNotAllowed" }])
  if (name === "InvalidPermissionId" || name === "HashMismatch") {
    return PolicyViolationError.make([{ _tag: "SessionRevoked" }])
  }

  let label: string = name
  if (name === "PolicyViolation") {
    const policy = Predicate.isString(revert.args[1]) ? policyName(revert.args[1]) : "unknown"
    if (policy === "RateLimitPolicy") return PolicyViolationError.make([{ _tag: "RateLimited", remaining: BigInt(0) }])
    if (policy === "SignaturePolicy") {
      return PolicyViolationError.make([{ _tag: "SignatureNotAllowed", detail: "SignaturePolicy refused it on chain" }])
    }
    label = `PolicyViolation(${policy})`
  }
  return BundlerError.rejected({
    ...options,
    code: failure.code ?? -32500,
    aa: aaCode(failure.text),
    data: revert.data,
    revert: label,
    detail: failure.text
  })
}

/**
 * The Namera error a failure stands for, or `undefined` when it is none Namera knows.
 *
 * @internal
 */
export const fromFailure = (failure: Failure, origin: Origin = {}): NameraError | undefined => {
  const vendor = origin.vendor ?? vendorOf(failure.url)
  const side = sideOf(failure, origin, vendor)
  const where = { vendor, url: failure.url }
  const text = failure.text

  if (failure.timeoutHash !== undefined) {
    return BundlerError.dropped({ ...where, hash: failure.timeoutHash, detail: text })
  }
  if (/EIP-?7702 is not supported/i.test(text)) {
    return CompatError.incompatible([{
      code: "EIP7702_UNSUPPORTED",
      message: `${
        vendor ?? "the"
      } bundler rejects EIP-7702 authorizations on EntryPoint 0.7: send the first operation through another bundler`
    }])
  }

  if (/sponsorship ?policy.*not active|policy (is )?(not active|inactive)/i.test(text)) {
    return PaymasterError.policyInactive({ ...where, detail: text })
  }
  if (/insufficient[_ ]balance|balance is below/i.test(text)) {
    return PaymasterError.insufficientBalance({ ...where, detail: text })
  }

  const revert = revertOf(failure)
  if (revert !== undefined) return fromRevert(revert, failure, where)

  if (side === "paymaster" && failure.code !== undefined) {
    return PaymasterError.rejected({ ...where, vendor: vendor ?? "unknown", message: text })
  }

  const aa = aaCode(text)
  const unsupported = /(\w+_\w+)(?: is)? not supported|Unsupported method[^\w]*(\w+_\w+)?/i.exec(text)
  if (aa === undefined && side === "bundler" && (failure.code === -32601 || unsupported !== null)) {
    const method = unsupported?.[1] ?? unsupported?.[2] ?? failure.method
    if (method !== undefined) return BundlerError.unsupported({ ...where, method, detail: text })
  }
  if (aa === undefined && failure.code === undefined) return undefined
  if (aa === undefined && side !== "bundler") return undefined

  const data = rawRevertData(failure)
  return BundlerError.rejected({
    ...where,
    code: failure.code ?? -32500,
    aa,
    ...(data === undefined ? {} : { data }),
    detail: text
  })
}

/**
 * Returns the Namera error a failure stands for: a Namera error found in its causes, a decoded bundler or paymaster
 * failure, or the failure itself.
 *
 * @internal
 */
export const decode = <E>(error: E): NameraError | E => {
  for (const cause of causes(error)) {
    if (isNameraError(cause)) return cause
  }
  return fromFailure(describe(error)) ?? error
}
