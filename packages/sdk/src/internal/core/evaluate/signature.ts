import * as AbiParameters from "ox/AbiParameters"
import * as Hex from "ox/Hex"

import type { nest } from "../agent/erc7739.ts"
import type { Compiled, Contracts } from "../session/compile.ts"
import { holds, type State, windowViolations } from "./evaluate.ts"
import type { Violation } from "./violation.ts"

// What Smart Sessions and `SignaturePolicy` would decide about a session-key ERC-1271 signature of typed data: the
// session enabled and within its window, the app domain and contents type allowed, and every signing policy
// accepting it (the verifying contract a verifier, the struct one of the allowed types with its field rules).

const signatureConfig = AbiParameters.from(["(address[] verifiers, bytes[] types)"])
const typedDataConfig = AbiParameters.from([
  "(bytes32 appDomainSeparator, bytes32 typeHash, (uint8 condition, uint256 index, bytes32[] refs)[] fields)"
])

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

const typeMatches = (
  type: Hex.Hex,
  nested: ReturnType<typeof nest>
): boolean => {
  const [config] = AbiParameters.decode(typedDataConfig, type)
  const { contentsData } = nested
  if (!same(config.appDomainSeparator, nested.appDomainSeparator)) return false
  if (Hex.size(contentsData) < 32 || !same(config.typeHash, Hex.slice(contentsData, 0, 32))) return false
  return config.fields.every((rule) => {
    const start = 32 + 32 * Number(rule.index)
    if (Hex.size(contentsData) < start + 32) return false
    return holds(rule.condition, rule.refs, Hex.toBigInt(Hex.slice(contentsData, start, start + 32)))
  })
}

/**
 * Every reason the session would refuse the signature; none when it would accept it. `verifier` is the contract that
 * will check the signature (the typed data's verifying contract), when known.
 *
 * @internal
 */
export const evaluateSignature = (options: {
  readonly compiled: Compiled
  readonly contracts: Contracts
  readonly nested: ReturnType<typeof nest>
  readonly verifier?: Hex.Hex | undefined
  readonly state: Pick<State, "time" | "enabled" | "revoked">
}): ReadonlyArray<Violation> => {
  const { compiled, contracts, nested, state, verifier } = options
  const window = windowViolations(compiled, state)
  if (window.length > 0) return window
  if (!state.enabled) return [{ _tag: "SessionNotEnabled" }]

  const allowed = compiled.erc7739Policies.allowedERC7739Content.some((content) =>
    same(content.appDomainSeparator, nested.appDomainSeparator) && content.contentNames.includes(nested.contentsType)
  )
  if (!allowed) {
    return [{ _tag: "SignatureNotAllowed", detail: "the session may not sign this app's typed data of this type" }]
  }
  const policies = compiled.erc7739Policies.erc1271Policies
  if (policies.length === 0) return [{ _tag: "SignatureNotAllowed", detail: "the session has no signing policy" }]

  return policies.flatMap(({ initData, policy }): ReadonlyArray<Violation> => {
    if (!same(policy, contracts.signaturePolicy)) return []
    const [config] = AbiParameters.decode(signatureConfig, initData)
    if (verifier !== undefined && !config.verifiers.some((entry) => same(entry, verifier))) {
      return [{ _tag: "SignatureNotAllowed", detail: `${verifier} may not verify the session's signatures` }]
    }
    if (config.types.length > 0 && !config.types.some((type) => typeMatches(type, nested))) {
      return [{ _tag: "SignatureNotAllowed", detail: "the typed data doesn't meet the session's signing rules" }]
    }
    return []
  })
}
