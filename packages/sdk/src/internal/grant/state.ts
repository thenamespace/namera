import * as Effect from "effect/Effect"
import type * as Hex from "ox/Hex"

import type * as ChainError from "../../ChainError.ts"
import type { State } from "../core/evaluate/evaluate.ts"
import { counterKey, counters, decodeUsage, encodeUsage } from "../core/evaluate/usage.ts"
import { decodeIsPermissionEnabled, encodeIsPermissionEnabled } from "../core/grant/enable.ts"
import * as core from "../core/grant/grant.ts"
import type { Compiled } from "../core/session/compile.ts"
import { call, type ReadClient } from "../viem/client.ts"

// The chain state the policy evaluator needs for a grant on one chain: whether its session is enabled, whether its
// grant can still enable it, and what each limit has used in the period of `time`. Reads run in parallel.

const isEmpty = (result: Hex.Hex | undefined) => result === undefined || result === "0x"

/**
 * Whether the grant's session is enabled on the chain.
 *
 * @internal
 */
export const isEnabled = (
  client: ReadClient,
  grant: core.Grant,
  chain: core.GrantChain
): Effect.Effect<boolean, ChainError.ChainError> =>
  call(client, {
    to: chain.contracts.smartSession,
    data: encodeIsPermissionEnabled(grant.id, core.accountAddress(grant))
  }).pipe(Effect.map((result) => !isEmpty(result) && decodeIsPermissionEnabled(result!)))

/**
 * Reads the state of the grant's session on the chain at `time`.
 *
 * @internal
 */
export const readState = Effect.fnUntraced(function*(
  client: ReadClient,
  options: {
    readonly grant: core.Grant
    readonly chain: core.GrantChain
    readonly compiled: Compiled
    readonly time: bigint
  }
): Effect.fn.Return<State, ChainError.ChainError> {
  const { chain, compiled, grant, time } = options
  const account = core.accountAddress(grant)
  const limits = counters(compiled, chain.contracts)
  const [enabled, nonce, used] = yield* Effect.all([
    isEnabled(client, grant, chain),
    call(client, { to: chain.contracts.smartSession, data: core.encodeGetNonce(grant.id, account) }).pipe(
      Effect.map((result) => (isEmpty(result) ? BigInt(0) : core.decodeGetNonce(result!)))
    ),
    Effect.all(
      limits.map((counter) =>
        call(client, {
          to: counter.policy,
          data: encodeUsage({
            counter,
            account,
            permissionId: grant.id,
            smartSession: chain.contracts.smartSession,
            time
          })
        }).pipe(
          Effect.map((result) => [counterKey(counter), isEmpty(result) ? BigInt(0) : decodeUsage(result!)] as const)
        )
      ),
      { concurrency: "unbounded" }
    )
  ], { concurrency: "unbounded" })
  // An installed grant has no enable signature; another grant's has been spent once the enable nonce moved on.
  const revoked = !enabled && (chain.signature === "0x" || nonce !== chain.nonce)
  return { time, enabled, revoked, usage: new Map(used) }
})
