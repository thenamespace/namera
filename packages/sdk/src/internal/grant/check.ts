import * as Effect from "effect/Effect"

import type * as ChainError from "../../ChainError.ts"
import * as GrantError from "../../GrantError.ts"
import * as PolicyViolationError from "../../PolicyViolationError.ts"
import { type Call, encodeCalls } from "../core/account/erc7579.ts"
import { evaluateOperation } from "../core/evaluate/evaluate.ts"
import * as core from "../core/grant/grant.ts"
import { compile } from "../core/session/compile.ts"
import { annotate, chainIdsOf, ofGrant, traced } from "../span.ts"
import { call, code, latestTimestamp, type ReadClient } from "../viem/client.ts"
import { entryPoint } from "../viem/smartAccount.ts"
import { readState } from "./state.ts"

/**
 * What a dry run found: whether the calls would pass, every policy violation, and how the calls ran when simulated
 * (`undefined` when they weren't, as for an undeployed account).
 *
 * @internal
 */
export interface Checked {
  readonly ok: boolean
  readonly violations: ReadonlyArray<PolicyViolationError.PolicyViolationReason>
  readonly simulation?: { readonly reverted: boolean } | undefined
}

/**
 * Evaluates calls against the grant's session on the client's chain, as the agent's account does before signing, and
 * simulates them from the EntryPoint when the account is deployed. Gas limits aren't known, so a gas budget isn't
 * charged.
 *
 * @internal
 */
export const check = Effect.fnUntraced(function*(
  client: ReadClient,
  options: { readonly grant: core.Grant; readonly calls: ReadonlyArray<Call> }
): Effect.fn.Return<Checked, ChainError.ChainError | GrantError.GrantError> {
  yield* annotate({ chainId: chainIdsOf(client), ...ofGrant(options.grant) })
  const { grant } = options
  const chainId = client.chain?.id
  const chain = grant.chains.find((entry) => core.chainId(entry.chain) === chainId)
  if (chain === undefined) {
    return yield* GrantError.make(new GrantError.ChainNotCovered({ chain: core.caip2(chainId ?? 0) }))
  }
  const account = core.accountAddress(grant)
  const compiled = compile(grant.session, chain.contracts)
  const state = yield* readState(client, { grant, chain, compiled, time: yield* latestTimestamp(client) })
  const calls = options.calls.map((entry) => ({
    to: entry.to,
    value: entry.value ?? BigInt(0),
    data: entry.data ?? "0x"
  }))
  const violations = evaluateOperation({
    compiled,
    contracts: chain.contracts,
    account,
    operation: { calls, sponsored: false },
    state
  }).map(PolicyViolationError.toReason)

  const deployed = (yield* code(client, account)) !== undefined
  const simulation = deployed
    ? yield* call(client, { from: entryPoint.address, to: account, data: encodeCalls(options.calls) }).pipe(
      Effect.as({ reverted: false }),
      Effect.catchTag(
        "ChainError",
        (error) => error.reason._tag === "Reverted" ? Effect.succeed({ reverted: true }) : Effect.fail(error)
      )
    )
    : undefined
  return { ok: violations.length === 0 && simulation?.reverted !== true, violations, simulation }
}, traced("Namera.Grant.check"))
