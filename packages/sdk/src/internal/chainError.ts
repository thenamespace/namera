import * as Predicate from "effect/Predicate"

import * as ChainError from "../ChainError.ts"

// viem and ox errors are recognised by their `name` and fields rather than with `instanceof`, so the translation
// keeps working with any copy or major of either library.
const named = (error: unknown, names: ReadonlyArray<string>): boolean =>
  Predicate.hasProperty(error, "name") && Predicate.isString(error.name) && names.includes(error.name)

const field = <A>(error: unknown, key: string, guard: (u: unknown) => u is A): A | undefined =>
  Predicate.hasProperty(error, key) && guard(error[key]) ? error[key] : undefined

const isHex = (u: unknown): u is `0x${string}` => Predicate.isString(u) && u.startsWith("0x")

const causes = function*(error: unknown): Generator<unknown> {
  let current = error
  for (let depth = 0; depth < 16 && current !== undefined; depth++) {
    yield current
    current = Predicate.hasProperty(current, "cause") ? current.cause : undefined
  }
}

const find = (error: unknown, predicate: (cause: unknown) => boolean) => {
  for (const cause of causes(error)) {
    if (predicate(cause)) return cause
  }
  return undefined
}

const detailOf = (error: unknown): string | undefined =>
  field(error, "shortMessage", Predicate.isString) ?? field(error, "message", Predicate.isString)

/**
 * Translates a failure thrown by the caller's client into a `ChainError`, keeping it as the cause.
 *
 * @internal
 */
export const fromUnknown = (error: unknown, method?: string): ChainError.ChainError => {
  if (ChainError.isChainError(error)) return error
  const detail = detailOf(error)
  const base = {
    cause: error,
    ...(detail === undefined ? {} : { detail }),
    ...(method === undefined ? {} : { method })
  }

  if (find(error, (cause) => named(cause, ["TimeoutError"])) !== undefined) {
    return ChainError.timeout(base)
  }

  const reverted = find(
    error,
    (cause) =>
      named(cause, ["ExecutionRevertedError", "ContractFunctionRevertedError", "CallExecutionError"])
      || field(cause, "code", Predicate.isNumber) === 3
  )
  if (reverted !== undefined) {
    const data = field(reverted, "data", isHex)
    return ChainError.reverted({ ...base, data })
  }

  const rpc = find(error, (cause) => Number.isInteger(field(cause, "code", Predicate.isNumber)))
  if (rpc !== undefined) {
    return ChainError.rpc({ ...base, code: field(rpc, "code", Predicate.isNumber) ?? 0 })
  }

  const url = field(
    find(error, (cause) => field(cause, "url", Predicate.isString) !== undefined),
    "url",
    Predicate.isString
  )
  return ChainError.transport({ ...base, url })
}

/**
 * A `ChainError` for a node answer that doesn't have the shape the method promises.
 *
 * @internal
 */
export const invalidResponse = (method: string, cause: unknown): ChainError.ChainError =>
  ChainError.transport({ method, detail: `Invalid ${method} response`, cause })
