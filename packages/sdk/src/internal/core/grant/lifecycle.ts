import * as AbiFunction from "ox/AbiFunction"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"

import type { Compiled } from "../session/compile.ts"

// The owner's calls that change a session on Smart Sessions after its grant: removing it (which also spends the enable
// nonce, so an unused grant can't enable it again), revoking an unused enable signature, and updating it in place.
// Also the views status reads.

// Typed as `string`: abitype's type-level parser gives up on tuples this deep; ox parses it at runtime.
const session: string =
  "(address sessionValidator, bytes sessionValidatorInitData, bytes32 salt, (address policy, bytes initData)[] userOpPolicies, ((bytes32 appDomainSeparator, string[] contentNames)[] allowedERC7739Content, (address policy, bytes initData)[] erc1271Policies) erc7739Policies, (bytes4 actionTargetSelector, address actionTarget, (address policy, bytes initData)[] actionPolicies)[] actions, bool permitERC4337Paymaster, uint48 validAfter, uint48 validUntil)"

const functions = {
  removeSession: AbiFunction.from("function removeSession(bytes32 permissionId)"),
  revokeEnableSignature: AbiFunction.from("function revokeEnableSignature(bytes32 permissionId)"),
  enableSessions: AbiFunction.from(`function enableSessions(${session}[] sessions) returns (bytes32[])`),
  disableUserOpPolicies: AbiFunction.from("function disableUserOpPolicies(bytes32 permissionId, address[] policies)"),
  disableActionId: AbiFunction.from("function disableActionId(bytes32 permissionId, bytes32 actionId)"),
  disableActionPolicies: AbiFunction.from(
    "function disableActionPolicies(bytes32 permissionId, bytes32 actionId, address[] policies)"
  ),
  disableERC1271Policies: AbiFunction.from(
    "function disableERC1271Policies(bytes32 permissionId, address[] policies, (bytes32 appDomainSeparator, string[] contentNames)[] contexts)"
  ),
  getSessionValidity: AbiFunction.from(
    "function getSessionValidity(bytes32 permissionId, address account) view returns (uint48 validAfter, uint48 validUntil)"
  ),
  getPermissionIDs: AbiFunction.from("function getPermissionIDs(address account) view returns (bytes32[])")
}

/** @internal */
export const encodeRemoveSession = (permissionId: Hex.Hex): Hex.Hex =>
  AbiFunction.encodeData(functions.removeSession, [permissionId])

/** @internal */
export const encodeRevokeEnableSignature = (permissionId: Hex.Hex): Hex.Hex =>
  AbiFunction.encodeData(functions.revokeEnableSignature, [permissionId])

/** @internal */
export const encodeGetSessionValidity = (permissionId: Hex.Hex, account: Hex.Hex): Hex.Hex =>
  AbiFunction.encodeData(functions.getSessionValidity, [permissionId, account])

/** @internal */
export const decodeGetSessionValidity = (
  result: Hex.Hex
): { readonly validAfter: number; readonly validUntil: number } => {
  const [validAfter, validUntil] = AbiFunction.decodeResult(functions.getSessionValidity, result)
  return { validAfter, validUntil }
}

/** @internal */
export const encodeGetPermissionIDs = (account: Hex.Hex): Hex.Hex =>
  AbiFunction.encodeData(functions.getPermissionIDs, [account])

/** @internal */
export const decodeGetPermissionIDs = (result: Hex.Hex): ReadonlyArray<Hex.Hex> =>
  AbiFunction.decodeResult(functions.getPermissionIDs, result)

/** Smart Sessions' id of an action: `keccak256(target ‖ selector)`. */
const actionId = (target: Hex.Hex, selector: Hex.Hex): Hex.Hex => Hash.keccak256(Hex.concat(target, selector))

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const missing = (from: ReadonlyArray<string>, to: ReadonlyArray<string>) =>
  [...new Set(from.map((entry) => entry.toLowerCase()))].filter((entry) => !to.some((other) => same(other, entry)))

/**
 * The owner's calls (to Smart Sessions) that turn the enabled session `previous` into `next`, which has the same
 * permission id: disable what `next` no longer has, then enable `next`, which adds what is new and reconfigures what
 * stays (and sets its window and paymaster flag). Each call spends the session's enable nonce, so the grant for
 * `previous` can't enable its policies again. A session that isn't enabled has nothing to disable: `next` is enabled
 * outright.
 *
 * @internal
 */
export const encodeUpdate = (options: {
  readonly permissionId: Hex.Hex
  readonly previous: Compiled
  readonly next: Compiled
  readonly enabled: boolean
}): ReadonlyArray<Hex.Hex> => {
  const { enabled, next, permissionId, previous } = options
  const calls: Array<Hex.Hex> = []
  if (enabled) {
    const userOp = missing(
      previous.userOpPolicies.map((entry) => entry.policy),
      next.userOpPolicies.map((entry) => entry.policy)
    )
    if (userOp.length > 0) {
      calls.push(AbiFunction.encodeData(functions.disableUserOpPolicies, [permissionId, userOp as Array<Hex.Hex>]))
    }

    for (const action of previous.actions) {
      const id = actionId(action.actionTarget, action.actionTargetSelector)
      const kept = next.actions.find((entry) =>
        same(entry.actionTarget, action.actionTarget) && same(entry.actionTargetSelector, action.actionTargetSelector)
      )
      if (kept === undefined) {
        calls.push(AbiFunction.encodeData(functions.disableActionId, [permissionId, id]))
        continue
      }
      const removed = missing(
        action.actionPolicies.map((entry) => entry.policy),
        kept.actionPolicies.map((entry) => entry.policy)
      )
      if (removed.length > 0) {
        calls.push(
          AbiFunction.encodeData(functions.disableActionPolicies, [permissionId, id, removed as Array<Hex.Hex>])
        )
      }
    }

    const erc1271 = missing(
      previous.erc7739Policies.erc1271Policies.map((entry) => entry.policy),
      next.erc7739Policies.erc1271Policies.map((entry) => entry.policy)
    )
    const contexts = previous.erc7739Policies.allowedERC7739Content.flatMap((context) => {
      const kept = next.erc7739Policies.allowedERC7739Content.find((entry) =>
        same(entry.appDomainSeparator, context.appDomainSeparator)
      )
      const names = context.contentNames.filter((name) => !(kept?.contentNames.includes(name) ?? false))
      return names.length === 0 ? [] : [{ appDomainSeparator: context.appDomainSeparator, contentNames: names }]
    })
    if (erc1271.length > 0 || contexts.length > 0) {
      calls.push(
        AbiFunction.encodeData(functions.disableERC1271Policies, [permissionId, erc1271 as Array<Hex.Hex>, contexts])
      )
    }
  }
  calls.push(AbiFunction.encodeData(functions.enableSessions, [[next]] as never))
  return calls
}
