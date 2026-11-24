import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Hex from "ox/Hex"

import type { Compiled } from "../session/compile.ts"
import { compress } from "./fastLz.ts"
import { chainId, entries, type Grant } from "./grant.ts"

// Enabling sessions on Smart Sessions: the owner's `enableSessions` call, the agent's ENABLE-mode signature (the
// owner's grant enables the session in the agent's first operation), and the view that says a session is enabled.

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

const enableSession = AbiParameters.from(
  `(uint8 chainDigestIndex, (uint64 chainId, bytes32 sessionDigest)[] hashesAndChainIds, ${session} sessionToEnable, bytes permissionEnableSig), bytes`
)

/**
 * A user operation signature in USE mode: `0x00 ‖ permissionId ‖ sessionKeySignature`.
 *
 * @internal
 */
export const encodeUseSignature = (permissionId: Hex.Hex, sessionKeySignature: Hex.Hex): Hex.Hex =>
  Hex.concat("0x00", permissionId, sessionKeySignature)

/**
 * A user operation signature in ENABLE mode, from the grant's entry for `chain`
 * (contracts/src/smart-sessions/lib/EncodeLib.sol): `0x01 ‖ flzCompress(abi.encode(EnableSession,
 * sessionKeySignature))`. Smart Sessions checks the owner's signature over every chain's digest, enables the session,
 * then validates the operation with it.
 *
 * @internal
 */
export const encodeEnableSignature = (
  grant: Pick<Grant, "account" | "session" | "chains">,
  chain: number,
  sessionKeySignature: Hex.Hex
): Hex.Hex => {
  const index = grant.chains.findIndex((entry) => chainId(entry.chain) === chain)
  return Hex.concat(
    "0x01",
    compress(AbiParameters.encode(enableSession, [
      {
        chainDigestIndex: index,
        hashesAndChainIds: grant.chains.map((entry) => ({
          chainId: BigInt(chainId(entry.chain)),
          sessionDigest: entry.sessionDigest
        })),
        sessionToEnable: entries(grant)[index]!.compiled,
        permissionEnableSig: grant.chains[index]!.signature
      },
      sessionKeySignature
    ] as never))
  )
}
