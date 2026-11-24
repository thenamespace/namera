/**
 * Failures talking to a chain through the caller's client: the transport, the node's JSON-RPC error, a reverted
 * call, or a timeout.
 *
 * **Details**
 *
 * Raw viem and ox errors from the client never leave Namera untranslated: they become a `ChainError`, with the
 * original error kept as the reason's `cause`.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

import { redactUrl, redactUrls } from "./internal/redact.ts"
import { version } from "./internal/version.ts"
import * as NameraError from "./NameraError.ts"

const TypeId = "~@namera-ai/sdk/ChainError" as const

const cause = Schema.optional(Schema.Defect())
const detail = Schema.optionalKey(Schema.String)

const withDetail = (summary: string, detail: string | undefined) =>
  detail === undefined ? summary : `${summary}: ${detail}`

/**
 * The client could not reach the node, or the node's answer could not be read.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Transport extends Schema.TaggedError<Transport>("@namera-ai/sdk/ChainError/Transport")("Transport", {
  detail,
  cause
}) {
  override get message(): string {
    return withDetail("The chain could not be reached", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Check the RPC URL and that the node is reachable."
  }
}

/**
 * The node answered the request with a JSON-RPC error.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Rpc extends Schema.TaggedError<Rpc>("@namera-ai/sdk/ChainError/Rpc")("Rpc", {
  code: Schema.Int,
  detail,
  cause
}) {
  override get message(): string {
    return withDetail(`The node rejected the request with code ${this.code}`, this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Check the request and that the node supports the method; the node's message is in `details`."
  }
}

/**
 * The call or transaction reverted on chain. `data` is the revert data, when the node returned it.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Reverted extends Schema.TaggedError<Reverted>("@namera-ai/sdk/ChainError/Reverted")("Reverted", {
  data: Schema.optionalKey(Schema.TemplateLiteral(["0x", Schema.String])),
  detail,
  cause
}) {
  override get message(): string {
    return withDetail("The call reverted", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Decode `reason.data` with the contract's ABI to see why it reverted."
  }
}

/**
 * The request did not complete within the client's timeout.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Timeout extends Schema.TaggedError<Timeout>("@namera-ai/sdk/ChainError/Timeout")("Timeout", {
  detail,
  cause
}) {
  override get message(): string {
    return withDetail("The request to the chain timed out", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Retry, or raise the client transport's `timeout`."
  }
}

/**
 * Schema for the reason of a `ChainError`.
 *
 * @stability experimental
 * @category schemas
 * @since 2.0.0
 */
export const ChainErrorReason: Schema.Union<[typeof Transport, typeof Rpc, typeof Reverted, typeof Timeout]> = Schema
  .Union([Transport, Rpc, Reverted, Timeout])

/**
 * The specific failure behind a `ChainError`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type ChainErrorReason = typeof ChainErrorReason.Type

/**
 * A failure talking to a chain. `reason` says which; `method`, `chainId` and `url` say where, when known. `url` never
 * includes credentials (user info, query, or a key in the path).
 *
 * **Example** (Narrowing on the reason)
 *
 * ```ts import.meta.vitest
 * import { ChainError } from "@namera-ai/sdk"
 *
 * const error = ChainError.rpc({ code: -32601, method: "eth_chainId" })
 *
 * error instanceof ChainError.ChainError && error.reason._tag === "Rpc" // => true
 * error.shortMessage // => "The node rejected the request with code -32601"
 * error.metaMessages[0] // => "Method: eth_chainId"
 * ```
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class ChainError extends Schema.TaggedError<ChainError>("@namera-ai/sdk/ChainError")("ChainError", {
  method: Schema.optionalKey(Schema.String),
  chainId: Schema.optionalKey(Schema.Int),
  url: Schema.optionalKey(Schema.String),
  reason: ChainErrorReason
}) implements NameraError.Fields {
  readonly [TypeId] = TypeId
  readonly [NameraError.TypeId] = NameraError.TypeId

  override readonly cause = this.reason

  get shortMessage(): string {
    return this.reason.message
  }

  get details(): string | undefined {
    const { cause } = this.reason
    return Predicate.isError(cause) ? redactUrls(cause.message) : undefined
  }

  get docsPath(): string | undefined {
    return undefined
  }

  get metaMessages(): ReadonlyArray<string> {
    return [
      ...(this.method === undefined ? [] : [`Method: ${this.method}`]),
      ...(this.chainId === undefined ? [] : [`Chain: ${this.chainId}`]),
      ...(this.url === undefined ? [] : [`URL: ${this.url}`]),
      `Hint: ${this.reason.hint}`
    ]
  }

  get version(): string {
    return `@namera-ai/sdk@${version}`
  }

  override get message(): string {
    return this.shortMessage
  }
}

/**
 * Checks whether a value is a `ChainError`, from any copy of the package.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isChainError = (u: unknown): u is ChainError => Predicate.hasProperty(u, TypeId)

/**
 * The options every `ChainError` constructor accepts: where the failure happened (the JSON-RPC method, the chain id
 * and the endpoint URL, which is stored without credentials), a detail for the message, and the underlying failure.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Options {
  readonly method?: string | undefined
  readonly chainId?: number | undefined
  readonly url?: string | undefined
  readonly detail?: string | undefined
  readonly cause?: unknown
}

const make = (reason: ChainErrorReason, { chainId, method, url }: Options) =>
  new ChainError({
    reason,
    ...(method === undefined ? {} : { method }),
    ...(chainId === undefined ? {} : { chainId }),
    ...(url === undefined ? {} : { url: redactUrl(url) })
  })

const reasonFields = ({ cause, detail }: Options) => ({
  ...(detail === undefined ? {} : { detail }),
  ...(cause === undefined ? {} : { cause })
})

/**
 * Creates a `ChainError` for a transport failure.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const transport = (options: Options = {}): ChainError => make(new Transport(reasonFields(options)), options)

/**
 * Creates a `ChainError` for a JSON-RPC error the node answered with.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const rpc = (options: Options & { readonly code: number }): ChainError =>
  make(new Rpc({ ...reasonFields(options), code: options.code }), options)

/**
 * Creates a `ChainError` for a reverted call. `data` is the revert data, when known.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const reverted = (options: Options & { readonly data?: `0x${string}` | undefined } = {}): ChainError =>
  make(
    new Reverted({ ...reasonFields(options), ...(options.data === undefined ? {} : { data: options.data }) }),
    options
  )

/**
 * Creates a `ChainError` for a request that timed out.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const timeout = (options: Options = {}): ChainError => make(new Timeout(reasonFields(options)), options)
