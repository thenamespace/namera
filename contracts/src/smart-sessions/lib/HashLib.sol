// SPDX-License-Identifier: AGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import {
    ActionData,
    ChainDigest,
    ERC7739Context,
    ERC7739Data,
    EnableSession,
    FALLBACK_TARGET_FLAG,
    FALLBACK_TARGET_SELECTOR_FLAG,
    FALLBACK_TARGET_SELECTOR_FLAG_PERMITTED_TO_CALL_SMARTSESSION,
    PolicyData,
    Session,
    SmartSessionMode
} from "../DataTypes.sol";
import {ISmartSession} from "../ISmartSession.sol";
import {EfficientHashLib} from "solady/utils/EfficientHashLib.sol";

// EIP-712 typehashes: keccak256 of the primary type followed by its referenced types in alphabetical order.
// Referenced type strings:
//   ActionData(bytes4 actionTargetSelector,address actionTarget,PolicyData[] actionPolicies)
//   ERC7739Context(bytes32 appDomainSeparator,string[] contentName)
//   ERC7739Data(ERC7739Context[] allowedERC7739Content,PolicyData[] erc1271Policies)
//   PolicyData(address policy,bytes initData)
//   SignedPermissions(bool permitGenericPolicy,bool permitAdminAccess,bool ignoreSecurityAttestations,
//     bool permitERC4337Paymaster,PolicyData[] userOpPolicies,ERC7739Data erc7739Policies,ActionData[] actions)
//   SignedSession(address account,SignedPermissions permissions,address sessionValidator,
//     bytes sessionValidatorInitData,bytes32 salt,uint48 validAfter,uint48 validUntil,address smartSession,
//     uint256 nonce)
//   ChainSession(uint64 chainId,SignedSession session)
//   MultiChainSession(ChainSession[] sessionsAndChainIds)
// Namera adds `validAfter` and `validUntil` to SignedSession, which changes the last three typehashes;
// the others equal upstream SmartSession's.

// PolicyData
bytes32 constant POLICY_DATA_TYPEHASH =
    0xdddac12cd8b10a071bea04226e97ac9490698394e19224abc47a5cfeeeb6ee97;
// ActionData ‖ PolicyData
bytes32 constant ACTION_DATA_TYPEHASH =
    0x35809859dccf8877c407a59527c2f00fb81ca9c198ebcb0c832c3deaa38d3502;
// ERC7739Context
bytes32 constant ERC7739_CONTEXT_TYPEHASH =
    0x006166b2b3a1edaf1da1ce02715d02d4979a4ab93755bff9ec054b0e6a96a1da;
// ERC7739Data ‖ ERC7739Context ‖ PolicyData
bytes32 constant ERC7739_DATA_TYPEHASH =
    0xdfd9b5718eebaa2484740b4ea6939e96189024c15848f16ccce901118114e152;
// SignedPermissions ‖ ActionData ‖ ERC7739Context ‖ ERC7739Data ‖ PolicyData
bytes32 constant SIGNED_PERMISSIONS_TYPEHASH =
    0x871289c05e426554eb0f843c9aa542f9c2bc4eba7742ada6a5c014d3568674d4;
// SignedSession ‖ ActionData ‖ ERC7739Context ‖ ERC7739Data ‖ PolicyData ‖ SignedPermissions
bytes32 constant SESSION_TYPEHASH =
    0x28790e2add7b715d5bfd0dc3b37a603e3824b9c2122e37167d7d776130e81745;
// ChainSession ‖ ActionData ‖ ERC7739Context ‖ ERC7739Data ‖ PolicyData ‖ SignedPermissions ‖ SignedSession
bytes32 constant CHAIN_SESSION_TYPEHASH =
    0x37e440dc09feca1843d478ab2cc74dbb761220fadacc00afa9414c6bde1bcd3c;
// MultiChainSession ‖ ActionData ‖ ChainSession ‖ ERC7739Context ‖ ERC7739Data ‖ PolicyData ‖ SignedPermissions
//   ‖ SignedSession
bytes32 constant MULTICHAIN_SESSION_TYPEHASH =
    0x88e4631f2dca0065122e90ca335755f770f098f3fd3f4bfad24bc6c083c3c839;

// keccak256("EIP712Domain(string name,string version)")
bytes32 constant _MULTICHAIN_DOMAIN_TYPEHASH =
    0xb03948446334eb9b2196d5eb166f69b9d49403eb4a12f36de8d3f9f3cb8e15c3;

// Domain of the multichain digest the owner signs: { name: "SmartSession", version: "1" }. Chain ID and verifying
// contract are omitted so one signature covers several chains; both are bound inside each session digest
// (`smartSession`) and its ChainSession entry (`chainId`).
// keccak256(abi.encode(_MULTICHAIN_DOMAIN_TYPEHASH, keccak256("SmartSession"), keccak256("1")))
bytes32 constant _MULTICHAIN_DOMAIN_SEPARATOR =
    0x057501e891776d1482927e5f094ae44049a4d893ba2d7b334dd7db8d38d3a0e1;

/// @notice EIP-712 hashing of sessions, so owners can sign them with `eth_signTypedData`.
library HashLib {
    using EfficientHashLib for bytes32[];
    using HashLib for *;

    /// @dev Checks that `enableData.sessionToEnable` (with `nonce`) is this chain's entry of the signed
    /// multichain list, and returns the multichain digest the owner signed.
    function getAndVerifyDigest(
        EnableSession memory enableData,
        address account,
        uint256 nonce,
        SmartSessionMode mode
    ) internal view returns (bytes32) {
        ChainDigest memory entry = enableData.hashesAndChainIds[enableData.chainDigestIndex];
        if (entry.chainId != block.chainid) revert ISmartSession.ChainIdMismatch(entry.chainId);

        bytes32 computedHash = enableData.sessionToEnable.sessionDigest(account, mode, nonce);
        if (entry.sessionDigest != computedHash) {
            revert ISmartSession.HashMismatch(entry.sessionDigest, computedHash);
        }
        return enableData.hashesAndChainIds.multichainDigest();
    }

    /// @dev `hashTypedData` of `MultiChainSession`, built from per-chain session digests rather than full
    /// sessions; matches what `eth_signTypedData` produces for the full structure.
    function multichainDigest(ChainDigest[] memory hashesAndChainIds)
        internal
        pure
        returns (bytes32)
    {
        uint256 length = hashesAndChainIds.length;
        bytes32[] memory a = EfficientHashLib.malloc(length);
        for (uint256 i; i < length; ++i) {
            a.set(
                i,
                keccak256(
                    abi.encode(
                        CHAIN_SESSION_TYPEHASH,
                        hashesAndChainIds[i].chainId,
                        hashesAndChainIds[i].sessionDigest
                    )
                )
            );
        }
        bytes32 structHash = keccak256(abi.encode(MULTICHAIN_SESSION_TYPEHASH, a.hash()));
        return keccak256(abi.encodePacked(hex"1901", _MULTICHAIN_DOMAIN_SEPARATOR, structHash));
    }

    /// @dev `hashStruct(SignedSession)` for `session` on this module. The chain ID lives in `ChainSession`.
    function sessionDigest(
        Session memory session,
        address account,
        SmartSessionMode mode,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32[] memory a = EfficientHashLib.malloc(10);
        a.set(0, SESSION_TYPEHASH);
        a.set(1, bytes32(uint256(uint160(account))));
        a.set(
            2,
            hashPermissions({
                session: session, ignoreSecurityAttestations: mode == SmartSessionMode.UNSAFE_ENABLE
            })
        );
        a.set(3, bytes32(uint256(uint160(address(session.sessionValidator)))));
        a.set(4, keccak256(session.sessionValidatorInitData));
        a.set(5, session.salt);
        a.set(6, bytes32(uint256(session.validAfter)));
        a.set(7, bytes32(uint256(session.validUntil)));
        a.set(8, bytes32(uint256(uint160(address(this)))));
        a.set(9, bytes32(nonce));
        return a.hash();
    }

    /// @dev `hashStruct(SignedPermissions)`. The fallback flags are derived from the actions so wallets show
    /// them explicitly; `ignoreSecurityAttestations` is set for UNSAFE_ENABLE (kept from upstream; registry
    /// checks are not performed).
    function hashPermissions(Session memory session, bool ignoreSecurityAttestations)
        internal
        pure
        returns (bytes32)
    {
        (bool permitFallback, bool permitUnsafeFallback, bytes32 actionsHash) =
            session.actions.hashActionDataArray();
        return keccak256(
            abi.encode(
                SIGNED_PERMISSIONS_TYPEHASH,
                permitFallback,
                permitUnsafeFallback,
                ignoreSecurityAttestations,
                session.permitERC4337Paymaster,
                session.userOpPolicies.hashPolicyDataArray(),
                session.erc7739Policies.hashERC7739Data(),
                actionsHash
            )
        );
    }

    function hashPolicyDataArray(PolicyData[] memory policyDatas) internal pure returns (bytes32) {
        uint256 length = policyDatas.length;
        bytes32[] memory a = EfficientHashLib.malloc(length);
        for (uint256 i; i < length; ++i) {
            a.set(
                i,
                keccak256(
                    abi.encode(
                        POLICY_DATA_TYPEHASH,
                        policyDatas[i].policy,
                        keccak256(policyDatas[i].initData)
                    )
                )
            );
        }
        return a.hash();
    }

    /// @dev Hashes the actions and reports whether they include the fallback action and the fallback action
    /// for calls into this module.
    function hashActionDataArray(ActionData[] memory actions)
        internal
        pure
        returns (bool permitFallback, bool permitUnsafeFallback, bytes32 actionsHash)
    {
        uint256 length = actions.length;
        bytes32[] memory a = EfficientHashLib.malloc(length);
        for (uint256 i; i < length; ++i) {
            ActionData memory action = actions[i];
            if (action.actionTarget == FALLBACK_TARGET_FLAG) {
                permitFallback =
                    permitFallback || action.actionTargetSelector == FALLBACK_TARGET_SELECTOR_FLAG;
                permitUnsafeFallback = permitUnsafeFallback
                    || action.actionTargetSelector
                        == FALLBACK_TARGET_SELECTOR_FLAG_PERMITTED_TO_CALL_SMARTSESSION;
            }
            a.set(
                i,
                keccak256(
                    abi.encode(
                        ACTION_DATA_TYPEHASH,
                        action.actionTargetSelector,
                        action.actionTarget,
                        action.actionPolicies.hashPolicyDataArray()
                    )
                )
            );
        }
        actionsHash = a.hash();
    }

    function hashERC7739Data(ERC7739Data memory data) internal pure returns (bytes32) {
        ERC7739Context[] memory contexts = data.allowedERC7739Content;
        uint256 length = contexts.length;
        bytes32[] memory a = EfficientHashLib.malloc(length);
        for (uint256 i; i < length; ++i) {
            a.set(
                i,
                keccak256(
                    abi.encode(
                        ERC7739_CONTEXT_TYPEHASH,
                        contexts[i].appDomainSeparator,
                        hashStringArray(contexts[i].contentNames)
                    )
                )
            );
        }
        return keccak256(
            abi.encode(ERC7739_DATA_TYPEHASH, a.hash(), data.erc1271Policies.hashPolicyDataArray())
        );
    }

    function hashStringArray(string[] memory strings) internal pure returns (bytes32) {
        uint256 length = strings.length;
        bytes32[] memory a = EfficientHashLib.malloc(length);
        for (uint256 i; i < length; ++i) {
            a.set(i, keccak256(bytes(strings[i])));
        }
        return a.hash();
    }

    /// @dev Key under which an ERC-7739 content name is stored.
    function hashERC7739Content(string memory content) internal pure returns (bytes32) {
        return keccak256(bytes(content));
    }
}
