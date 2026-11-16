// SPDX-License-Identifier: AGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import "./DataTypes.sol";

import {ISmartSession} from "./ISmartSession.sol";
import {SmartSessionBase} from "./core/SmartSessionBase.sol";
import {SmartSessionERC7739} from "./core/SmartSessionERC7739.sol";
import {IActionPolicy, IUserOpPolicy} from "./interfaces/IPolicy.sol";
import {ConfigLib} from "./lib/ConfigLib.sol";
import {EncodeLib} from "./lib/EncodeLib.sol";
import {ExecutionLib} from "./lib/ExecutionLib.sol";
import {HashLib} from "./lib/HashLib.sol";
import {IdLib} from "./lib/IdLib.sol";
import {PolicyLib} from "./lib/PolicyLib.sol";
import {ValidationDataLib} from "./lib/ValidationDataLib.sol";
import {EnumerableSet} from "./utils/EnumerableSet4337.sol";
import {ERC4337} from "solady/accounts/ERC4337.sol";
import {LibERC7579} from "solady/accounts/LibERC7579.sol";
import {SignatureCheckerLib} from "solady/utils/SignatureCheckerLib.sol";

/// @title SmartSession
/// @notice ERC-7579 validator for scoped session keys on ERC-4337 accounts. See `ISmartSession`.
contract SmartSession is ISmartSession, SmartSessionBase, SmartSessionERC7739 {
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using IdLib for *;
    using ValidationDataLib for ValidationData;
    using HashLib for *;
    using PolicyLib for *;
    using ConfigLib for *;
    using ExecutionLib for bytes;
    using EncodeLib for bytes;

    /// @inheritdoc ISmartSession
    function validateUserOp(ERC4337.PackedUserOperation calldata userOp, bytes32 userOpHash)
        external
        override
        returns (ValidationData)
    {
        // Session state is stored per account, so only the account itself may validate its operations.
        address account = userOp.sender;
        if (account != msg.sender) revert InvalidUserOpSender(account);

        (SmartSessionMode mode, PermissionId permissionId, bytes calldata packedSig) =
            userOp.signature.unpackMode();

        if (mode.isUseMode()) {
            return _enforcePolicies(permissionId, userOpHash, userOp, packedSig, account);
        }
        if (mode.isEnableMode()) {
            (EnableSession memory enableData, bytes memory sessionKeySig) = packedSig.decodeEnable();
            permissionId = enableData.sessionToEnable.toPermissionIdMemory();
            _enableSessionWithOwnerSignature(enableData, permissionId, account, mode);
            return _enforcePolicies(permissionId, userOpHash, userOp, sessionKeySig, account);
        }
        revert UnsupportedSmartSessionMode(mode);
    }

    /// @notice ERC-7579 ERC-1271 forwarding for session keys.
    /// @param signature `abi.encodePacked(permissionId, sessionKeySignature, APP_DOMAIN_SEPARATOR, contents,
    /// contentsDescription, uint16(contentsDescription.length))`, optionally ERC-6492 wrapped.
    function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata signature)
        external
        view
        override
        returns (bytes4 result)
    {
        // ERC-7739 support probe. 0x77390002 marks the version that binds signatures to `hash`
        // (upstream SmartSession reports 0x77390001).
        if (hash == 0x7739773977397739773977397739773977397739773977397739773977397739) {
            return bytes4(0x77390002);
        }
        // A session may not authorize another session.
        if (sender == address(this)) return EIP1271_FAILED;

        bool success = _erc1271IsValidSignatureViaNestedEIP712(
            sender, hash, _erc1271UnwrapSignature(signature)
        );
        assembly ("memory-safe") {
            // `success ? 0x1626ba7e : 0xffffffff`
            result := shl(224, or(0x1626ba7e, sub(0, iszero(success))))
        }
    }

    /// @dev Verifies the owner's signature over the multichain session digest, then enables the session. The
    /// account's ERC-1271 check must not route back into this module; account implementations ensure this.
    function _enableSessionWithOwnerSignature(
        EnableSession memory enableData,
        PermissionId permissionId,
        address account,
        SmartSessionMode mode
    ) internal {
        uint256 nonce = $signerNonce[permissionId][account]++;
        bytes32 hash = enableData.getAndVerifyDigest(account, nonce, mode);
        if (!SignatureCheckerLib.isValidERC1271SignatureNow(
                account, hash, enableData.permissionEnableSig
            )) {
            revert InvalidEnableSignature(account, hash);
        }
        _enableSession(permissionId, enableData.sessionToEnable);
    }

    /// @dev Runs user operation and action policies, then the session key signature check, and bounds the result
    /// by the session validity window. Reverts on policy violations; returns `ERC4337_VALIDATION_FAILED` for an
    /// invalid session key signature.
    function _enforcePolicies(
        PermissionId permissionId,
        bytes32 userOpHash,
        ERC4337.PackedUserOperation calldata userOp,
        bytes memory sessionKeySig,
        address account
    ) internal returns (ValidationData vd) {
        if (!$enabledSessions.contains(account, PermissionId.unwrap(permissionId))) {
            revert InvalidPermissionId(permissionId);
        }

        {
            // A paymaster may only be used if the session permits it, and then at least one user operation
            // policy must run (it can be a permissive policy, or one that inspects `paymasterAndData`).
            uint256 minPolicies = 0;
            if (userOp.paymasterAndData.length != 0) {
                if (!$permitERC4337Paymaster[permissionId][account]) {
                    revert PaymasterValidationNotEnabled(permissionId);
                }
                minPolicies = 1;
            }
            vd = $userOpPolicies.check({
                permissionId: permissionId,
                callOnIPolicy: abi.encodeCall(
                    IUserOpPolicy.checkUserOpPolicy,
                    (permissionId.toUserOpPolicyId().toConfigId(), userOp)
                ),
                minPolicies: minPolicies
            });
        }

        // Every action needs at least one policy, so open permissions require an explicit permissive policy.
        bytes4 selector = bytes4(userOp.callData[:4]);
        if (selector == ERC7579_EXECUTE_SELECTOR) {
            bytes32 mode = userOp.callData.executionMode();
            bytes1 callType = LibERC7579.getCallType(mode);
            // Only the default exec type, and no mode selector or payload: an account that interprets them
            // (e.g. ERC-7821 batch of batches) could decode the execution data differently from this module.
            if (uint256(mode) << 8 != 0) revert UnsupportedExecutionType();
            if (callType == LibERC7579.CALLTYPE_BATCH) {
                vd = vd.intersect(
                    $actionPolicies.actionPolicies
                        .checkBatch7579Exec({
                            userOp: userOp, permissionId: permissionId, minPolicies: 1
                        })
                );
            } else if (callType == LibERC7579.CALLTYPE_SINGLE) {
                (address target, uint256 value, bytes calldata callData) =
                    LibERC7579.decodeSingle(userOp.callData.decodeUserOpCallData());
                vd = vd.intersect(
                    $actionPolicies.actionPolicies
                        .checkSingle7579Exec({
                            permissionId: permissionId,
                            target: target,
                            value: value,
                            callData: callData,
                            minPolicies: 1
                        })
                );
            } else {
                // Delegatecall and static call types are not supported.
                revert UnsupportedCallType(callType);
            }
        } else if (selector == ERC4337_EXECUTE_USER_OP_SELECTOR) {
            // executeUserOp would hand the whole user operation to the account unchecked.
            revert UnsupportedExecutionType();
        } else {
            // Any other account function is an action on the account itself.
            ActionId actionId = account.toActionId(selector);
            vd = vd.intersect(
                $actionPolicies.actionPolicies[actionId].check({
                    permissionId: permissionId,
                    callOnIPolicy: abi.encodeCall(
                        IActionPolicy.checkAction,
                        (permissionId.toConfigId(actionId), account, account, 0, userOp.callData)
                    ),
                    minPolicies: 1
                })
            );
        }

        // Reverts if the session has no validator.
        bool validSig = $sessionValidators.isValidISessionValidator({
            hash: userOpHash, account: account, permissionId: permissionId, signature: sessionKeySig
        });
        if (!validSig) return ERC4337_VALIDATION_FAILED;

        return vd.intersect(_sessionValidityData(permissionId, account));
    }

    /// @dev Session-key ERC-1271 check after ERC-7739 unwrapping. Returns false unless the session is enabled and
    /// within its validity window, the content is allowed for the app domain, every ERC-1271 policy (at least one)
    /// passes and the session key signature is valid.
    // Session expiry is time-based by design (see _isWithinSessionValidity).
    // slither-disable-next-line timestamp
    function _erc1271IsValidSignatureNowCalldata(
        address sender,
        bytes32 hash,
        bytes calldata signature,
        bytes32 appDomainSeparator,
        bytes calldata contents
    ) internal view virtual override returns (bool) {
        PermissionId permissionId = PermissionId.wrap(bytes32(signature[:32]));
        signature = signature[32:];

        if (
            !$enabledSessions.contains(msg.sender, PermissionId.unwrap(permissionId))
                || !_isWithinSessionValidity(permissionId, msg.sender)
                || !$enabledERC7739.enabledContentNames[permissionId][appDomainSeparator].contains(
                    msg.sender, string(contents).hashERC7739Content()
                )
        ) return false;

        bool policiesPass = $erc1271Policies.checkERC1271({
            account: msg.sender,
            requestSender: sender,
            hash: hash,
            signature: signature,
            permissionId: permissionId,
            configId: permissionId.toErc1271PolicyId().toConfigId(),
            minPoliciesToEnforce: 1
        });
        if (!policiesPass) return false;

        return $sessionValidators.isValidISessionValidator({
            hash: hash, account: msg.sender, permissionId: permissionId, signature: signature
        });
    }
}
