import * as Effect from "effect/Effect"
import * as Address from "ox/Address"
import type * as Hex from "ox/Hex"

import type * as ChainError from "../../ChainError.ts"
import * as GrantError from "../../GrantError.ts"
import { counterKey, limitsOf, resetsAt } from "../core/evaluate/usage.ts"
import * as core from "../core/grant/grant.ts"
import {
  decodeGetPermissionIDs,
  decodeGetSessionValidity,
  encodeGetPermissionIDs,
  encodeGetSessionValidity
} from "../core/grant/lifecycle.ts"
import { compile, type Compiled } from "../core/session/compile.ts"
import { contracts } from "../session/contracts.ts"
import { call, latestTimestamp, type ReadClient } from "../viem/client.ts"
import { isEnabled as readEnabled, readState } from "./state.ts"

// A grant's state on its chains, read without any key: enabled or not, within its window or not, revoked, and what
// each budget has used and has left.

/**
 * A grant's state on a chain.
 *
 * @internal
 */
export type State = "pending-enable" | "active" | "expired" | "not-yet-valid" | "revoked"

/**
 * One budget's usage in the current period. `period` is in seconds (0 for the lifetime); `resetsAt` is when the next
 * period starts, in seconds, absent for the lifetime.
 *
 * @internal
 */
export interface LimitStatus {
  readonly kind: "spend" | "value" | "rateLimit" | "gas"
  readonly token?: Hex.Hex | undefined
  readonly budget: bigint
  readonly used: bigint
  readonly remaining: bigint
  readonly period: number
  readonly resetsAt?: number | undefined
}

/**
 * A grant's state on one chain.
 *
 * @internal
 */
export interface ChainStatus {
  readonly chain: `eip155:${number}`
  readonly state: State
  readonly enabled: boolean
  readonly validAfter: number
  readonly validUntil: number | "never"
  readonly limits: ReadonlyArray<LimitStatus>
}

/**
 * A grant's state: overall (the most usable of its chains'), its window, each chain's, and the first chain's limits.
 *
 * @internal
 */
export interface Status {
  readonly state: State
  readonly validAfter: number
  readonly validUntil: number | "never"
  readonly chains: ReadonlyArray<ChainStatus>
  readonly limits: ReadonlyArray<LimitStatus>
}

/**
 * The grant's entry for the client's chain.
 *
 * @internal
 */
export const chainOf = (
  client: ReadClient,
  grant: core.Grant
): Effect.Effect<core.GrantChain, GrantError.GrantError> => {
  const chainId = client.chain?.id
  const chain = grant.chains.find((entry) => core.chainId(entry.chain) === chainId)
  return chain === undefined
    ? Effect.fail(GrantError.make(new GrantError.ChainNotCovered({ chain: core.caip2(chainId ?? 0) })))
    : Effect.succeed(chain)
}

const stateOf = (options: {
  readonly enabled: boolean
  readonly revoked: boolean
  readonly time: bigint
  readonly validAfter: number
  readonly validUntil: number
}): State => {
  if (!options.enabled && options.revoked) return "revoked"
  if (options.validUntil !== 0 && options.time > BigInt(options.validUntil)) return "expired"
  if (options.time < BigInt(options.validAfter)) return "not-yet-valid"
  return options.enabled ? "active" : "pending-enable"
}

const limitStatuses = (
  compiled: Compiled,
  chain: core.GrantChain,
  usage: ReadonlyMap<string, bigint>,
  time: bigint
): ReadonlyArray<LimitStatus> =>
  limitsOf(compiled, chain.contracts).map((limit) => {
    const used = usage.get(counterKey(limit)) ?? BigInt(0)
    const reset = resetsAt(limit.period, time)
    return {
      kind: limit.kind,
      ...(limit.token === undefined ? {} : { token: limit.token }),
      budget: limit.budget,
      used,
      remaining: used > limit.budget ? BigInt(0) : limit.budget - used,
      period: Number(limit.period),
      ...(reset === undefined ? {} : { resetsAt: reset })
    }
  })

/**
 * The grant's state on the client's chain.
 *
 * @internal
 */
export const chainStatus = Effect.fnUntraced(function*(
  client: ReadClient,
  grant: core.Grant
): Effect.fn.Return<ChainStatus, ChainError.ChainError | GrantError.GrantError> {
  const chain = yield* chainOf(client, grant)
  const compiled = compile(grant.session, chain.contracts)
  const time = yield* latestTimestamp(client)
  const state = yield* readState(client, { grant, chain, compiled, time })
  // An enabled session's window is the one stored on chain (an update may have changed it).
  const window = state.enabled
    ? yield* call(client, {
      to: chain.contracts.smartSession,
      data: encodeGetSessionValidity(grant.id, core.accountAddress(grant))
    }).pipe(Effect.map((result) => decodeGetSessionValidity(result!)))
    : { validAfter: compiled.validAfter, validUntil: compiled.validUntil }
  return {
    chain: chain.chain,
    state: stateOf({ ...state, ...window }),
    enabled: state.enabled,
    validAfter: window.validAfter,
    validUntil: window.validUntil === 0 ? "never" : window.validUntil,
    limits: limitStatuses(compiled, chain, state.usage, time)
  }
})

// The most usable state first: a grant active on one chain and revoked on another can still act.
const precedence: ReadonlyArray<State> = ["active", "pending-enable", "not-yet-valid", "expired", "revoked"]

/**
 * The grant's state on each client's chain, and overall.
 *
 * @internal
 */
export const getStatus = Effect.fnUntraced(function*(
  clients: ReadonlyArray<ReadClient>,
  grant: core.Grant
): Effect.fn.Return<Status, ChainError.ChainError | GrantError.GrantError> {
  const chains = yield* Effect.all(clients.map((client) => chainStatus(client, grant)), { concurrency: "unbounded" })
  const [first] = chains
  if (first === undefined) {
    return yield* GrantError.make(new GrantError.ChainNotCovered({ chain: core.caip2(0) }))
  }
  return {
    state: precedence.find((state) => chains.some((chain) => chain.state === state))!,
    validAfter: first.validAfter,
    validUntil: first.validUntil,
    chains,
    limits: first.limits
  }
})

/**
 * What is left of the grant's budget for a token (or native value without one) on the client's chain: the tightest of
 * its limits, or `undefined` when nothing limits it.
 *
 * @internal
 */
export const getRemainingLimit = Effect.fnUntraced(function*(
  client: ReadClient,
  options: { readonly grant: core.Grant; readonly token?: Hex.Hex | undefined }
): Effect.fn.Return<
  { readonly remaining: bigint; readonly resetsAt?: number | undefined } | undefined,
  ChainError.ChainError | GrantError.GrantError
> {
  const { limits } = yield* chainStatus(client, options.grant)
  const { token } = options
  const matching = limits.filter((limit) =>
    token === undefined
      ? limit.kind === "value"
      : limit.kind === "spend" && limit.token !== undefined && Address.isEqual(limit.token, token)
  )
  const tightest = matching.reduce<LimitStatus | undefined>(
    (best, limit) => (best === undefined || limit.remaining < best.remaining ? limit : best),
    undefined
  )
  if (tightest === undefined) return undefined
  return {
    remaining: tightest.remaining,
    ...(tightest.resetsAt === undefined ? {} : { resetsAt: tightest.resetsAt })
  }
})

/**
 * Whether the grant's session is enabled on the client's chain.
 *
 * @internal
 */
export const isEnabled = Effect.fnUntraced(function*(
  client: ReadClient,
  grant: core.Grant
): Effect.fn.Return<boolean, ChainError.ChainError | GrantError.GrantError> {
  return yield* readEnabled(client, grant, yield* chainOf(client, grant))
})

/**
 * A session enabled on an account: its permission id and window, and the grant among those given that it belongs to.
 *
 * @internal
 */
export interface Listed {
  readonly id: Hex.Hex
  readonly validAfter: number
  readonly validUntil: number | "never"
  readonly grant?: core.Grant | undefined
  readonly foreign: boolean
}

/**
 * The sessions enabled on an account on the client's chain, matched to `grants` by permission id. Smart Sessions
 * stores ids and policy configurations but not sessions, so a session without a grant here is `foreign`.
 *
 * @internal
 */
export const list = Effect.fnUntraced(function*(
  client: ReadClient,
  options: { readonly account: Hex.Hex; readonly grants?: ReadonlyArray<core.Grant> | undefined }
): Effect.fn.Return<ReadonlyArray<Listed>, ChainError.ChainError> {
  const { account } = options
  const ids = yield* call(client, { to: contracts.smartSession, data: encodeGetPermissionIDs(account) }).pipe(
    Effect.map((result) => (result === undefined || result === "0x" ? [] : decodeGetPermissionIDs(result)))
  )
  return yield* Effect.all(
    ids.map((id) =>
      call(client, { to: contracts.smartSession, data: encodeGetSessionValidity(id, account) }).pipe(
        Effect.map((result): Listed => {
          const { validAfter, validUntil } = decodeGetSessionValidity(result!)
          const grant = options.grants?.find((entry) =>
            entry.id.toLowerCase() === id.toLowerCase() && Address.isEqual(core.accountAddress(entry), account)
          )
          return {
            id,
            validAfter,
            validUntil: validUntil === 0 ? "never" : validUntil,
            ...(grant === undefined ? {} : { grant }),
            foreign: grant === undefined
          }
        })
      )
    ),
    { concurrency: "unbounded" }
  )
})
