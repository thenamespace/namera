// SPDX-License-Identifier: AGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";
import {LibERC7579} from "solady/accounts/LibERC7579.sol";
import {SignatureCheckerLib} from "solady/utils/SignatureCheckerLib.sol";

import {
    ActionId,
    EIP1271_FAILED,
    ERC1271Request,
    ERC4337_EXECUTE_USER_OP_SELECTOR,
    ERC4337_VALIDATION_FAILED,
    ERC7579_EXECUTE_SELECTOR,
    EnableSession,
    PermissionId,
    SESSION_HOOK_TAG,
    SmartSessionMode,
    ValidationData
} from "./DataTypes.sol";
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

    // ---------------------------------------------------------------------------------------------
    // ERC-7579 validator
    // ---------------------------------------------------------------------------------------------

    /// @inheritdoc ISmartSession
    function validateUserOp(ERC4337.PackedUserOperation calldata userOp, bytes32 userOpHash)
        external
        override
        returns (ValidationData)
    {
        // Session state is stored per account, so only the account itself may validate its operations.
        address account = userOp.sender;
        if (account != msg.sender) revert InvalidUserOpSender(account);

        (SmartSessionMode mode, PermissionId permissionId, bytes calldata packed) =
            userOp.signature.unpackMode();

        if (mode.isUseMode()) {
            return _enforcePolicies(permissionId, userOpHash, userOp, packed, account);
        }
        if (mode.isEnableMode()) {
            (EnableSession memory enableData, bytes memory sessionKeySignature) =
                packed.decodeEnable();
            permissionId = enableData.sessionToEnable.toPermissionIdMemory();
            _enableSessionWithOwnerSignature(enableData, permissionId, account, mode);
            return _enforcePolicies(permissionId, userOpHash, userOp, sessionKeySignature, account);
        }
        revert UnsupportedSmartSessionMode(mode);
    }

    /// @notice ERC-7579 ERC-1271 forwarding for session keys.
    /// @param signature `abi.encodePacked(permissionId, sessionKeySignature, contentsData, policyData,
    /// uint16(contentsData.length), uint16(policyData.length), APP_DOMAIN_SEPARATOR, contents, contentsDescription,
    /// uint16(contentsDescription.length))`, optionally ERC-6492 wrapped. `contentsData` (the signed struct's
    /// EIP-712 `encodeData`, or empty) and `policyData` are for ERC-1271 policies; see `I1271TypedDataPolicy`.
    function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata signature)
        external
        view
        override
        returns (bytes4 result)
    {
        // ERC-7739 support probe. Upstream SmartSession reports 0x77390001; 0x77390002 bound signatures to `hash`,
        // and 0x77390003 adds the typed data for ERC-1271 policies to the signature.
        if (hash == 0x7739773977397739773977397739773977397739773977397739773977397739) {
            return bytes4(0x77390003);
        }
        // A session may not authorize another session.
        // Namera: nor an account asking about itself (the account checking its own digests): a session signs for apps.
        if (sender == address(this) || sender == msg.sender) return EIP1271_FAILED;

        bool success = _erc1271IsValidSignatureViaNestedEIP712(
            sender, hash, _erc1271UnwrapSignature(signature)
        );
        assembly ("memory-safe") {
            // `success ? 0x1626ba7e : 0xffffffff`.
            result := shl(224, or(0x1626ba7e, sub(0, iszero(success))))
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Internal functions
    // ---------------------------------------------------------------------------------------------

    /// @dev Verifies the owner's signature over the multichain session digest, then enables the session. The
    /// account's ERC-1271 check must not route back into this module; account implementations ensure this.
    function _enableSessionWithOwnerSignature(
        EnableSession memory enableData,
        PermissionId permissionId,
        address account,
        SmartSessionMode mode
    ) internal {
        uint256 nonce = _nonce(permissionId, account);
        ++$signerNonce[permissionId][account];
        bytes32 hash = enableData.getAndVerifyDigest(account, nonce, mode);
        if (!SignatureCheckerLib.isValidERC1271SignatureNow(
                account, hash, enableData.permissionEnableSig
            )) {
            revert InvalidEnableSignature(account, hash);
        }
        // Namera: the same events as enabling directly, so indexers see sessions enabled in a user operation. The
        // only call before is the account's ERC-1271 view, and the nonce was spent before it.
        // forge-lint: disable-next-line(reentrancy-events)
        emit NonceIterated(permissionId, account, $signerNonce[permissionId][account]);
        // forge-lint: disable-next-line(reentrancy-events)
        emit SessionCreated(permissionId, account);
        _enableSession(permissionId, enableData.sessionToEnable);
    }

    /// @dev Runs user operation and action policies, then the session key signature check, and bounds the result
    /// by the session validity window. Reverts on policy violations; returns `ERC4337_VALIDATION_FAILED` for an
    /// invalid session key signature.
    function _enforcePolicies(
        PermissionId permissionId,
        bytes32 userOpHash,
        ERC4337.PackedUserOperation calldata userOp,
        bytes memory sessionKeySignature,
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

        // Namera: an operation tagged for SessionHook must name the session that validates it, or another session
        // could run this one's execution policies (and change their state) with its own operation.
        bytes calldata callData = userOp.callData;
        uint256 length = callData.length;
        if (
            length >= 64 && bytes32(callData[length - 32:]) == SESSION_HOOK_TAG
                && bytes32(callData[length - 64:length - 32]) != PermissionId.unwrap(permissionId)
        ) revert InvalidSessionHookTag(permissionId);

        vd = vd.intersect(_checkActions(permissionId, callData, account));

        // Reverts if the session has no validator.
        bool valid = $sessionValidators.isValidISessionValidator({
            hash: userOpHash,
            account: account,
            permissionId: permissionId,
            signature: sessionKeySignature
        });
        if (!valid) return ERC4337_VALIDATION_FAILED;

        return vd.intersect(_sessionValidityData(permissionId, account));
    }

    /// @dev Checks the operation's calls against the session's action policies. `callData` is the user operation's
    /// calldata; `executeUserOp(execute(…))` (Kernel, with SessionHook bound) is checked as the inner `execute`.
    function _checkActions(PermissionId permissionId, bytes calldata callData, address account)
        internal
        returns (ValidationData vd)
    {
        // Every action needs at least one policy, so open permissions require an explicit permissive policy.
        bytes4 selector = bytes4(callData[:4]);
        if (selector == ERC4337_EXECUTE_USER_OP_SELECTOR) {
            // Namera: Kernel runs a validator's hook (SessionHook) only through `executeUserOp`, which executes
            // `callData[4:]`; that inner call is checked as the operation and must be `execute`.
            callData = callData[4:];
            selector = bytes4(callData[:4]);
            if (selector != ERC7579_EXECUTE_SELECTOR) revert UnsupportedExecutionType();
        }
        if (selector == ERC7579_EXECUTE_SELECTOR) {
            bytes32 mode = callData.executionMode();
            bytes1 callType = LibERC7579.getCallType(mode);
            // Only the default exec type, and no mode selector or payload: an account that interprets them
            // (e.g. ERC-7821 batch of batches) could decode the execution data differently from this module.
            if (uint256(mode) << 8 != 0) revert UnsupportedExecutionType();
            if (callType == LibERC7579.CALLTYPE_BATCH) {
                vd = $actionPolicies.actionPolicies
                    .checkBatch7579Exec({
                        executeCallData: callData, permissionId: permissionId, minPolicies: 1
                    });
            } else if (callType == LibERC7579.CALLTYPE_SINGLE) {
                (address target, uint256 value, bytes calldata targetCallData) =
                    LibERC7579.decodeSingle(callData.decodeUserOpCallData());
                vd = $actionPolicies.actionPolicies
                    .checkSingle7579Exec({
                        permissionId: permissionId,
                        target: target,
                        value: value,
                        callData: targetCallData,
                        minPolicies: 1
                    });
            } else {
                // Delegatecall and static call types are not supported.
                revert UnsupportedCallType(callType);
            }
        } else {
            // Any other account function is an action on the account itself.
            ActionId actionId = account.toActionId(selector);
            vd = $actionPolicies.actionPolicies[actionId].check({
                permissionId: permissionId,
                callOnIPolicy: abi.encodeCall(
                    IActionPolicy.checkAction,
                    (permissionId.toConfigId(actionId), account, account, 0, callData)
                ),
                minPolicies: 1
            });
        }
    }

    /// @dev Session-key ERC-1271 check after ERC-7739 unwrapping. Returns false unless the session is enabled and
    /// within its validity window, the content is allowed for the app domain, the typed data (when given) hashes to
    /// `contents`, every ERC-1271 policy (at least one) passes and the session key signature is valid.
    /// `signature` is `permissionId ‖ sessionKeySignature ‖ contentsData ‖ policyData ‖ uint16(contentsData.length)
    /// ‖ uint16(policyData.length)` (Namera): see `I1271TypedDataPolicy`.
    // Session expiry is time-based by design (see `_isWithinSessionValidity`).
    // slither-disable-next-line timestamp
    function _erc1271IsValidSignatureNowCalldata(
        address sender,
        bytes32 hash,
        bytes calldata signature,
        bytes32 appDomainSeparator,
        bytes calldata contentsDescription
    ) internal view virtual override returns (bool) {
        ERC1271Request memory request = ERC1271Request({
            requestSender: sender,
            hash: hash,
            appDomainSeparator: appDomainSeparator,
            contentsData: "",
            policyData: ""
        });
        bool wellFormed;
        (wellFormed, signature) = _readTypedData(request, signature, _contents(contentsDescription));
        if (!wellFormed) return false;
        PermissionId permissionId = PermissionId.wrap(bytes32(signature[:32]));
        signature = signature[32:];

        if (
            !$enabledSessions.contains(msg.sender, PermissionId.unwrap(permissionId))
                || !_isWithinSessionValidity(permissionId, msg.sender)
                || !$enabledERC7739.enabledContentNames[permissionId][appDomainSeparator].contains(
                    msg.sender, string(contentsDescription).hashERC7739Content()
                )
        ) return false;

        bool policiesPass = $erc1271Policies.checkERC1271({
            account: msg.sender,
            request: request,
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

    /// @dev Reads `contentsData ‖ policyData ‖ uint16(contentsData.length) ‖ uint16(policyData.length)` off the end
    /// of `signature` into `request`, returning the rest (`permissionId ‖ sessionKeySignature`). Not well formed
    /// when the lengths overrun the signature, or when `contentsData` is given and does not hash to `contents`.
    function _readTypedData(
        ERC1271Request memory request,
        bytes calldata signature,
        bytes32 contents
    ) internal pure returns (bool wellFormed, bytes calldata rest) {
        rest = signature;
        uint256 length = signature.length;
        if (length < 36) return (false, rest);
        // The two lengths, then (once checked against the signature) where each part starts.
        uint256 policyDataStart = uint16(bytes2(signature[length - 2:]));
        uint256 contentsDataStart = uint16(bytes2(signature[length - 4:length - 2]));
        if (length < 36 + contentsDataStart + policyDataStart) return (false, rest);
        policyDataStart = length - 4 - policyDataStart;
        contentsDataStart = policyDataStart - contentsDataStart;

        request.contentsData = signature[contentsDataStart:policyDataStart];
        if (request.contentsData.length != 0 && keccak256(request.contentsData) != contents) {
            return (false, rest);
        }
        request.policyData = signature[policyDataStart:length - 4];
        return (true, signature[:contentsDataStart]);
    }
}
