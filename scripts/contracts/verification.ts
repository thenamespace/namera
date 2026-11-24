import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as Option from "effect/Option"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import * as Str from "effect/String"

import { VerifierFailed } from "../errors.ts"
import type { Chain } from "./schema.ts"

/** A block explorer that verifies contract sources. */
export type Verifier = Chain["verifiers"][number]

/**
 * Where a contract stands on one verifier: `pending` when a submission was accepted but not yet processed, `skipped`
 * when the verifier cannot be used (no API key).
 */
export type VerificationStatus = "verified" | "pending" | "failed" | "skipped"

/** One recorded contract on one verifier. */
export interface Verification {
  readonly label: string
  readonly address: string
  readonly verifier: Verifier
  readonly status: VerificationStatus
}

const SourcifyContract = Schema.Struct({ match: Schema.NullOr(Schema.String) })
const SourcifyError = Schema.Struct({ message: Schema.String })

/**
 * Decodes Sourcify's `GET /v2/contract/{chainId}/{address}` response: a contract is verified when `match` is set
 * (`match` or `exact_match`); 404 means Sourcify does not know it.
 */
export const sourcifyVerified = (status: number, body: unknown): Result.Result<boolean, string> => {
  if (status === 404) return Result.succeed(false)
  if (status === 200) {
    return Option.match(Schema.decodeUnknownOption(SourcifyContract)(body), {
      onNone: () => Result.fail("unexpected response"),
      onSome: (contract) => Result.succeed(contract.match !== null)
    })
  }
  return Result.fail(
    Option.match(Schema.decodeUnknownOption(SourcifyError)(body), {
      onNone: () => `HTTP ${status}`,
      onSome: (error) => `HTTP ${status}: ${error.message}`
    })
  )
}

const EtherscanResponse = Schema.Struct({ status: Schema.String, message: Schema.String, result: Schema.Unknown })
const EtherscanSources = Schema.NonEmptyArray(Schema.Struct({ SourceCode: Schema.String }))

/**
 * Decodes Etherscan V2's `getsourcecode` response: a contract is verified when its `SourceCode` is not empty. Errors
 * (invalid key, rate limit, unsupported chain) come back as `status: "0"` with the reason in `result`.
 */
export const etherscanVerified = (body: unknown): Result.Result<boolean, string> => {
  const response = Schema.decodeUnknownOption(EtherscanResponse)(body)
  if (Option.isNone(response)) return Result.fail("unexpected response")
  const { message, result, status } = response.value
  if (status !== "1") return Result.fail(typeof result === "string" && result.length > 0 ? result : message)
  return Option.match(Schema.decodeUnknownOption(EtherscanSources)(result), {
    onNone: () => Result.fail("unexpected response"),
    onSome: ([source]) => Result.succeed(source.SourceCode.length > 0)
  })
}

/**
 * Whether `address` on `chainId` is verified on `verifier`, read from the explorer's API. Failures never carry the
 * request: its URL holds the Etherscan API key.
 */
export const isVerified = Effect.fnUntraced(function*(
  verifier: Verifier,
  chainId: number,
  address: string,
  etherscanKey: string
) {
  const client = yield* HttpClient.HttpClient
  const failed = (message: string) => VerifierFailed.make({ verifier, message })

  const request = verifier === "sourcify"
    ? HttpClientRequest.get(`https://sourcify.dev/server/v2/contract/${chainId}/${address}`)
    : HttpClientRequest.get("https://api.etherscan.io/v2/api", {
      urlParams: {
        chainid: String(chainId),
        module: "contract",
        action: "getsourcecode",
        address,
        apikey: etherscanKey
      }
    })
  const response = yield* client.execute(request).pipe(
    Effect.mapError((error) => failed(`request failed (${error.reason._tag})`))
  )
  const body = yield* response.json.pipe(Effect.mapError(() => failed(`HTTP ${response.status}: not JSON`)))

  const decoded = verifier === "sourcify" ? sourcifyVerified(response.status, body) : etherscanVerified(body)
  if (Result.isFailure(decoded)) return yield* failed(decoded.failure)
  return decoded.success
})

/**
 * The status of a `forge verify-contract --watch` run that exited non-zero: a submission the verifier has accepted
 * but not processed yet ("still pending", "Pending in queue") is pending, anything else failed.
 */
export const submissionStatus = (output: string): "pending" | "failed" =>
  Str.includes("pending")(Str.toLowerCase(output)) ? "pending" : "failed"

/** A table of `verifications`: one row per contract, one column per verifier. */
export const verificationTable = (
  verifiers: ReadonlyArray<Verifier>,
  verifications: ReadonlyArray<Verification>
): string => {
  const labels = Arr.dedupe(Arr.map(verifications, (verification) => verification.label))
  const rows = Arr.map(labels, (label) => [
    label,
    ...Arr.map(verifiers, (verifier) =>
      Option.match(
        Arr.findFirst(verifications, (verification) =>
          verification.label === label && verification.verifier === verifier),
        {
          onNone: () =>
            "-",
          onSome: (verification) => verification.status
        }
      ))
  ])
  const table = [["contract", ...verifiers], ...rows]
  const widths = Arr.map(
    table[0] ?? [],
    (_, column) => Math.max(...Arr.map(table, (row) => (row[column] ?? "").length))
  )
  return Arr.join(
    Arr.map(
      table,
      (row) => Str.trimEnd(Arr.join(Arr.map(row, (cell, column) => Str.padEnd(widths[column] ?? 0)(cell)), "  "))
    ),
    "\n"
  )
}

/**
 * The problems that fail verification of `chain`: every contract still pending or failed, then the command that
 * retries them (already verified contracts are skipped). Empty when everything is verified or skipped.
 */
export const verificationProblems = (chain: Chain, verifications: ReadonlyArray<Verification>): Array<string> => {
  const unsettled = Arr.filter(
    verifications,
    (verification) => verification.status === "pending" || verification.status === "failed"
  )
  if (unsettled.length === 0) return []
  return [
    ...Arr.map(unsettled, ({ label, status, verifier }) => `${label} on ${verifier}: ${status}`),
    `rerun: pnpm contracts:verify --chain ${chain.slug}`
  ]
}
