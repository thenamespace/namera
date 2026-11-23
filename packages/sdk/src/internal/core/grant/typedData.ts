import type * as Hex from "ox/Hex"
import * as TypedData from "ox/TypedData"

import { type Compiled, FALLBACK } from "../session/compile.ts"

// The EIP-712 data an owner signs to grant a session (contracts/src/smart-sessions/lib/HashLib.sol): a
// `MultiChainSession` of one `ChainSession` per chain, in the domain { name: "SmartSession", version: "1" }, which
// has no chain id so one structure covers every chain. Each chain's `SignedSession` binds the account, the compiled
// permissions, the session validator and its config, the salt, the window, Smart Sessions' address and the enable
// nonce.

/**
 * The EIP-712 types of `MultiChainSession`, field names as `HashLib`'s type strings have them.
 *
 * @internal
 */
export const types = {
  MultiChainSession: [{ name: "sessionsAndChainIds", type: "ChainSession[]" }],
  ChainSession: [{ name: "chainId", type: "uint64" }, { name: "session", type: "SignedSession" }],
  SignedSession: [
    { name: "account", type: "address" },
    { name: "permissions", type: "SignedPermissions" },
    { name: "sessionValidator", type: "address" },
    { name: "sessionValidatorInitData", type: "bytes" },
    { name: "salt", type: "bytes32" },
    { name: "validAfter", type: "uint48" },
    { name: "validUntil", type: "uint48" },
    { name: "smartSession", type: "address" },
    { name: "nonce", type: "uint256" }
  ],
  SignedPermissions: [
    { name: "permitGenericPolicy", type: "bool" },
    { name: "permitAdminAccess", type: "bool" },
    { name: "ignoreSecurityAttestations", type: "bool" },
    { name: "permitERC4337Paymaster", type: "bool" },
    { name: "userOpPolicies", type: "PolicyData[]" },
    { name: "erc7739Policies", type: "ERC7739Data" },
    { name: "actions", type: "ActionData[]" }
  ],
  ActionData: [
    { name: "actionTargetSelector", type: "bytes4" },
    { name: "actionTarget", type: "address" },
    { name: "actionPolicies", type: "PolicyData[]" }
  ],
  ERC7739Data: [
    { name: "allowedERC7739Content", type: "ERC7739Context[]" },
    { name: "erc1271Policies", type: "PolicyData[]" }
  ],
  ERC7739Context: [{ name: "appDomainSeparator", type: "bytes32" }, { name: "contentName", type: "string[]" }],
  PolicyData: [{ name: "policy", type: "address" }, { name: "initData", type: "bytes" }]
} as const

/**
 * The domain of the multichain digest.
 *
 * @internal
 */
export const domain = { name: "SmartSession", version: "1" } as const

/**
 * One chain of a grant: the account there, its compiled session, Smart Sessions' address and the enable nonce.
 *
 * @internal
 */
export interface ChainEntry {
  readonly chainId: number
  readonly account: Hex.Hex
  readonly compiled: Compiled
  readonly smartSession: Hex.Hex
  readonly nonce: bigint
}

/**
 * The `SignedSession` struct of one chain, in ENABLE mode (security attestations not ignored).
 *
 * @internal
 */
export const signedSession = (entry: ChainEntry) => {
  const { compiled } = entry
  const fallback = (selector: string) =>
    compiled.actions.some((action) =>
      action.actionTarget.toLowerCase() === FALLBACK.target && action.actionTargetSelector === selector
    )
  return {
    account: entry.account,
    permissions: {
      permitGenericPolicy: fallback(FALLBACK.selector),
      permitAdminAccess: fallback("0x00000002"),
      ignoreSecurityAttestations: false,
      permitERC4337Paymaster: compiled.permitERC4337Paymaster,
      userOpPolicies: compiled.userOpPolicies,
      erc7739Policies: {
        allowedERC7739Content: compiled.erc7739Policies.allowedERC7739Content.map((context) => ({
          appDomainSeparator: context.appDomainSeparator,
          contentName: context.contentNames
        })),
        erc1271Policies: compiled.erc7739Policies.erc1271Policies
      },
      actions: compiled.actions
    },
    sessionValidator: compiled.sessionValidator,
    sessionValidatorInitData: compiled.sessionValidatorInitData,
    salt: compiled.salt,
    validAfter: compiled.validAfter,
    validUntil: compiled.validUntil,
    smartSession: entry.smartSession,
    nonce: entry.nonce
  }
}

/**
 * The typed data the owner signs for every chain of a grant.
 *
 * @internal
 */
export const toTypedData = (entries: ReadonlyArray<ChainEntry>) => ({
  domain,
  types,
  primaryType: "MultiChainSession" as const,
  message: {
    sessionsAndChainIds: entries.map((entry) => ({ chainId: BigInt(entry.chainId), session: signedSession(entry) }))
  }
})

/**
 * One chain's session digest, `hashStruct(SignedSession)`, as `SmartSession.getSessionDigest` returns it.
 *
 * @internal
 */
export const sessionDigest = (entry: ChainEntry): Hex.Hex =>
  TypedData.hashStruct({
    types: types as unknown as TypedData.TypedData,
    primaryType: "SignedSession",
    data: signedSession(entry) as unknown as Record<string, unknown>
  })

/**
 * The digest the owner's ERC-1271 signature covers: `hashTypedData` of the `MultiChainSession`.
 *
 * @internal
 */
export const multichainDigest = (entries: ReadonlyArray<ChainEntry>): Hex.Hex =>
  TypedData.getSignPayload(toTypedData(entries) as unknown as TypedData.Definition<TypedData.TypedData, string>)
