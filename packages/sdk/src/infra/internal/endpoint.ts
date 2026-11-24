import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"

import * as ChainError from "../../ChainError.ts"
import { describe, fromFailure, type Origin } from "../../internal/decode.ts"
import { isNameraError } from "../../internal/nameraError.ts"
import type { Client } from "../../internal/viem/infra.ts"
import type { NameraError } from "../../NameraError.ts"

/**
 * Where a vendor endpoint's failures come from, and the credentials that must never appear in them.
 *
 * @internal
 */
export interface Endpoint extends Origin {
  readonly secrets: ReadonlyArray<string>
}

const scrub = (text: string, secrets: ReadonlyArray<string>): string =>
  secrets.filter((secret) => secret.length > 0).reduce((out, secret) => out.split(secret).join("***"), text)

/**
 * Translates a failure of a request to a vendor endpoint into a Namera error: a decoded bundler or paymaster failure,
 * or a `ChainError`. The original error is dropped, since viem's errors repeat the endpoint URL with its credentials.
 *
 * @internal
 */
export const translate =
  (endpoint: Endpoint) => (error: unknown, method: string, endpointUrl?: string | undefined): NameraError => {
    if (isNameraError(error)) return error
    const failure = describe(error)
    const text = scrub(failure.text, endpoint.secrets)
    const url = endpointUrl ?? failure.url
    const decoded = fromFailure({ ...failure, text, method, url }, endpoint)
    if (decoded !== undefined) return decoded

    const context = { method, url, ...(text === "" ? {} : { detail: text }) }
    if (failure.timedOut === true) return ChainError.timeout(context)
    if (failure.code !== undefined) return ChainError.rpc({ ...context, code: failure.code })
    return ChainError.transport(context)
  }

/**
 * Sends a JSON-RPC request through a client, failing with a Namera error.
 *
 * @internal
 */
export const request = (
  client: Client,
  method: string,
  params: ReadonlyArray<unknown>,
  endpoint: Endpoint
): Effect.Effect<unknown, NameraError> =>
  Effect.tryPromise({
    try: () => client.request({ method, params } as never) as Promise<unknown>,
    catch: (error) => translate(endpoint)(error, method)
  })

/**
 * A JSON-RPC quantity (`0x`-prefixed hex) as a bigint, or `undefined` when the value isn't one.
 *
 * @internal
 */
export const quantity = (u: unknown): bigint | undefined =>
  Predicate.isString(u) && /^0x[0-9a-fA-F]+$/.test(u) ? BigInt(u) : undefined

/**
 * Fails with a `ChainError` for an answer of an unexpected shape.
 *
 * @internal
 */
export const unreadable = (method: string): ChainError.ChainError =>
  ChainError.transport({ method, detail: `the answer to ${method} could not be read` })
