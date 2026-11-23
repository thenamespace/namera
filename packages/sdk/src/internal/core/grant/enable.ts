import * as AbiFunction from "ox/AbiFunction"
import type * as Hex from "ox/Hex"

import type { Compiled } from "../session/compile.ts"

// Enabling sessions on Smart Sessions: the owner's `enableSessions` call, and the view that says a session is
// enabled. (The agent's ENABLE-mode signature, `0x01 ‖ flzCompress(abi.encode(EnableSession, sessionKeySignature))`,
// is the agent account's, phase 012; `session` below is the tuple both share.)

// Typed as `string`: abitype's type-level parser gives up on tuples this deep; ox parses it at runtime.
const session: string =
  "(address sessionValidator, bytes sessionValidatorInitData, bytes32 salt, (address policy, bytes initData)[] userOpPolicies, ((bytes32 appDomainSeparator, string[] contentNames)[] allowedERC7739Content, (address policy, bytes initData)[] erc1271Policies) erc7739Policies, (bytes4 actionTargetSelector, address actionTarget, (address policy, bytes initData)[] actionPolicies)[] actions, bool permitERC4337Paymaster, uint48 validAfter, uint48 validUntil)"

const enableSessions = AbiFunction.from(`function enableSessions(${session}[] sessions) returns (bytes32[])`)

/**
 * The owner's call that enables sessions directly (not in ENABLE mode): `SmartSession.enableSessions`.
 *
 * @internal
 */
export const encodeEnableSessions = (sessions: ReadonlyArray<Compiled>): Hex.Hex =>
  AbiFunction.encodeData(enableSessions, [sessions])

const isPermissionEnabled = AbiFunction.from(
  "function isPermissionEnabled(bytes32 permissionId, address account) view returns (bool)"
)

/** @internal */
export const encodeIsPermissionEnabled = (permissionId: Hex.Hex, account: Hex.Hex): Hex.Hex =>
  AbiFunction.encodeData(isPermissionEnabled, [permissionId, account])

/** @internal */
export const decodeIsPermissionEnabled = (result: Hex.Hex): boolean =>
  AbiFunction.decodeResult(isPermissionEnabled, result)
