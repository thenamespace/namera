// SPDX-License-Identifier: AGPL-3.0-only
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

/**
 * @title SmartSession
 * @author [alphabetically] Filipp Makarov (Biconomy) & zeroknots.eth (Rhinestone)
 * @dev A collaborative effort between Rhinestone and Biconomy to create a powerful
 *      and flexible session key management system for ERC-4337 and ERC-7579 accounts.
 * SmartSession is an advanced module for ERC-4337 and ERC-7579 compatible smart contract wallets, enabling granular
 * control over session keys. It allows users to create and manage temporary, limited-permission access to their
 * accounts through configurable policies. The module supports various policy types, including user operation
 * validation, action-specific policies, and ERC-1271 signature validation. SmartSession implements a unique "enable
 * flow" that allows session keys to be created within the first user operation, enhancing security and user experience.
 * It uses a nested EIP-712 approach for signature validation, providing phishing resistance and compatibility with
 * existing wallet interfaces. The module also supports batched executions and integrates with external policy contracts
 * for flexible permission management. Overall, SmartSession offers a comprehensive solution for secure, temporary
 * account access in the evolving landscape of account abstraction.
 */
contract SmartSession is ISmartSession, SmartSessionBase, SmartSessionERC7739 {
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using IdLib for *;
    using ValidationDataLib for ValidationData;
    using HashLib for *;
    using PolicyLib for *;
    using ConfigLib for *;
    using ExecutionLib for bytes;
    using EncodeLib for bytes;

    /**
     * @notice Validates a user operation for ERC4337/ERC7579 compatibility
     * @dev This function is the entry point for validating user operations in SmartSession
     * @dev This function will dissect the userop.signature field, and parse out the provided PermissionId, which
     * identifies a
     * unique ID of a dapp for a specific user. n Policies and one Signer contract are mapped to this Id and will be
     * checked. Only UserOps that pass policies and signer checks, are considered valid.
     * Enable Flow:
     *     SmartSessions allows session keys to be created within the "first" UserOp. If the enable flow is chosen, the
     *     EnableSession data, which is packed in userOp.signature is parsed, and stored in the SmartSession storage.
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @return vd ValidationData containing the validation result
     */
    function validateUserOp(ERC4337.PackedUserOperation calldata userOp, bytes32 userOpHash)
        external
        override
        returns (ValidationData vd)
    {
        // ensure that userOp.sender == msg.sender == account
        // SmartSession will sstore configs for a certain account,
        // so we have to ensure that unauthorized access is not possible
        address account = userOp.sender;
        if (account != msg.sender) revert InvalidUserOpSender(account);

        // unpacking data packed in userOp.signature
        (SmartSessionMode mode, PermissionId permissionId, bytes calldata packedSig) =
            userOp.signature.unpackMode();

        // If the SmartSession.USE mode was selected, no further policies have to be enabled.
        // We can go straight to userOp validation
        // This condition is the average case, so should be handled as the first condition
        if (mode.isUseMode()) {
            // USE mode: Directly enforce policies without enabling new ones
            vd = _enforcePolicies({
                permissionId: permissionId,
                userOpHash: userOpHash,
                userOp: userOp,
                decompressedSignature: packedSig,
                account: account
            });
        }
        // If the SmartSession.ENABLE mode was selected, the userOp.signature will contain the EnableSession data
        // This data will be used to enable policies and signer for the session
        // The signature of the user on the EnableSession data will be checked
        // If the signature is valid, the policies and signer will be enabled
        // after enabling the session, the policies will be enforced on the userOp similarly to the SmartSession.USE
        else if (mode.isEnableMode()) {
            // unpack the EnableSession data and signature
            // calculate the permissionId from the Session data
            EnableSession memory enableData;
            bytes memory usePermissionSig;
            (enableData, usePermissionSig) = packedSig.decodeEnable();
            permissionId = enableData.sessionToEnable.toPermissionIdMemory();

            // ENABLE mode: Enable new policies and then enforce them
            _enablePolicies({
                enableData: enableData, permissionId: permissionId, account: account, mode: mode
            });

            vd = _enforcePolicies({
                permissionId: permissionId,
                userOpHash: userOpHash,
                userOp: userOp,
                decompressedSignature: usePermissionSig,
                account: account
            });
        }
        // if an Unknown mode is provided, the function will revert
        else {
            revert UnsupportedSmartSessionMode(mode);
        }
    }

    /**
     * @notice Enables policies for a session during user operation validation
     * @dev This function handles the enabling of new policies and session validators
     * @param enableData The EnableSession data containing the session to enable
     * @param permissionId The unique identifier for the permission set
     * @param account The account for which policies are being enabled
     * @param mode The SmartSession mode being used
     */
    function _enablePolicies(
        EnableSession memory enableData,
        PermissionId permissionId,
        address account,
        SmartSessionMode mode
    ) internal {
        // Increment nonce to prevent replay attacks
        uint256 nonce = $signerNonce[permissionId][account]++;
        bytes32 hash = enableData.getAndVerifyDigest(account, nonce, mode);

        // require signature on account
        // this is critical as it is the only way to ensure that the user is aware of the policies and signer
        // NOTE: although SmartSession implements a ERC1271 feature,
        // it CAN NOT be used as a valid ERC1271 validator for
        // this step. SmartSessions ERC1271 function must prevent this
        if (!SignatureCheckerLib.isValidERC1271SignatureNow(
                account, hash, enableData.permissionEnableSig
            )) {
            revert InvalidEnableSignature(account, hash);
        }

        Session memory session = enableData.sessionToEnable;

        // Record the session before calling into policies (checks-effects-interactions).
        // slither-disable-next-line unused-return
        $enabledSessions.add(msg.sender, PermissionId.unwrap(permissionId));
        _setPermit4337Paymaster(permissionId, session.permitERC4337Paymaster);
        _setSessionValidity(permissionId, session.validAfter, session.validUntil);

        // Enable mode can involve enabling ISessionValidator (new Permission)
        // or just adding policies (existing permission)
        // a) ISessionValidator is not set => enable ISessionValidator
        // b) ISessionValidator is set => just add policies (below)
        // Attention: if the same policy that has already been configured is added again,
        // the policy will be overwritten with the new configuration
        if (!_isISessionValidatorSet(permissionId, account)) {
            $sessionValidators.enable({
                permissionId: permissionId,
                sessionValidator: session.sessionValidator,
                sessionValidatorConfig: session.sessionValidatorInitData
            });
        }
        $enabledERC7739.enable({
            contexts: session.erc7739Policies.allowedERC7739Content, permissionId: permissionId
        });

        $userOpPolicies.enable({
            policyType: PolicyType.USER_OP,
            permissionId: permissionId,
            configId: permissionId.toUserOpPolicyId().toConfigId(),
            policyDatas: session.userOpPolicies
        });
        $erc1271Policies.enable({
            policyType: PolicyType.ERC1271,
            permissionId: permissionId,
            configId: permissionId.toErc1271PolicyId().toConfigId(),
            policyDatas: session.erc7739Policies.erc1271Policies
        });
        $actionPolicies.enable({permissionId: permissionId, actionPolicyDatas: session.actions});
    }

    /**
     * @notice Enforces policies and checks ISessionValidator signature for a session
     * @dev This function is the core of policy enforcement in SmartSession
     * @param permissionId The unique identifier for the permission set
     * @param userOpHash The hash of the user operation
     * @param userOp The user operation being validated
     * @param decompressedSignature The decompressed signature for validation
     * @param account The account for which policies are being enforced
     * @return vd ValidationData containing the result of policy checks
     */
    function _enforcePolicies(
        PermissionId permissionId,
        bytes32 userOpHash,
        ERC4337.PackedUserOperation calldata userOp,
        bytes memory decompressedSignature,
        address account
    ) internal returns (ValidationData vd) {
        // ensure that the permissionId is enabled
        if (!$enabledSessions.contains({
                account: account, value: PermissionId.unwrap(permissionId)
            })) {
            revert InvalidPermissionId(permissionId);
        }

        /* --- Scope: Check UserOp Policies --- */
        {
            // by default, minPolicies for userOp policies is 0
            // in the case of the UserOp having paymasterAndData and the user opted in, to allow the PermissionID to use
            // paymasters, this value will be 1
            uint256 minPolicies = 0;

            // if a paymaster is used in this userop, we must ensure that the user authorized this PermissionID to use
            // any
            // paymasters. Should this be the case, a UserOpPolicy must run, this could be a yes policy, or a specific
            // UserOpPolicy that can destructure the paymasterAndData and inspect it
            if (userOp.paymasterAndData.length != 0) {
                if ($permitERC4337Paymaster[permissionId][account]) minPolicies = 1;
                else revert PaymasterValidationNotEnabled(permissionId);
            }
            /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
            /*                    Check UserOp Policies                   */
            /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/
            // Check UserOp policies
            // This reverts if policies are violated
            vd = $userOpPolicies.check({
                permissionId: permissionId,
                callOnIPolicy: abi.encodeCall(
                    IUserOpPolicy.checkUserOpPolicy,
                    (permissionId.toUserOpPolicyId().toConfigId(), userOp)
                ),
                minPolicies: minPolicies
            });
        }
        /* --- End Scope: Check UserOp Policies --- */

        bytes4 selector = bytes4(userOp.callData[0:4]);

        /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
        /*                      Handle Executions                     */
        /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/
        // if the selector indicates that the userOp is an execution,
        // action policies have to be checked
        if (selector == ERC7579_EXECUTE_SELECTOR) {
            bytes32 mode = userOp.callData.executionMode();
            bytes1 callType = LibERC7579.getCallType(mode);
            // ERC7579 allows for different execution types, but SmartSession only supports the default execution type
            if (LibERC7579.getExecType(mode) != LibERC7579.EXECTYPE_DEFAULT) {
                revert UnsupportedExecutionType();
            }
            // DEFAULT EXEC & BATCH CALL
            else if (callType == LibERC7579.CALLTYPE_BATCH) {
                vd = vd.intersect(
                    $actionPolicies.actionPolicies
                        .checkBatch7579Exec({
                            userOp: userOp,
                            permissionId: permissionId,
                            minPolicies: 1 // minimum of one actionPolicy must be set.
                        })
                );
            }
            // DEFAULT EXEC & SINGLE CALL
            else if (callType == LibERC7579.CALLTYPE_SINGLE) {
                (address target, uint256 value, bytes calldata callData) =
                    LibERC7579.decodeSingle(userOp.callData.decodeUserOpCallData());
                vd = vd.intersect(
                    $actionPolicies.actionPolicies
                        .checkSingle7579Exec({
                            permissionId: permissionId,
                            target: target,
                            value: value,
                            callData: callData,
                            minPolicies: 1 // minimum of one actionPolicy must be set.
                        })
                );
            }
            // DelegateCalls are not supported by SmartSession
            else {
                revert UnsupportedCallType(callType);
            }
        }
        // SmartSession does not support executeUserOp,
        // should this function selector be used in the userOp: revert
        // see why: https://github.com/erc7579/smartsessions/issues/17
        else if (selector == ERC4337_EXECUTE_USER_OP_SELECTOR) {
            revert UnsupportedExecutionType();
        }
        /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
        /*                        Handle Actions                      */
        /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/
        // all other executions are supported and are handled by the actionPolicies
        else {
            ActionId actionId = account.toActionId(bytes4(userOp.callData[:4]));

            vd = vd.intersect(
                $actionPolicies.actionPolicies[actionId].check({
                    permissionId: permissionId,
                    callOnIPolicy: abi.encodeCall(
                        IActionPolicy.checkAction,
                        (
                            permissionId.toConfigId(actionId),
                            account, // account
                            account, // target
                            0, // value
                            userOp.callData // data
                        )
                    ),
                    minPolicies: 1 // minimum of one actionPolicy must be set.
                })
            );
        }

        /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
        /*                 Check SessionKey ISessionValidator         */
        /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/
        // perform signature check with ISessionValidator
        // this function will revert if no ISessionValidator is set for this permissionId
        bool validSig = $sessionValidators.isValidISessionValidator({
            hash: userOpHash,
            account: account,
            permissionId: permissionId,
            signature: decompressedSignature
        });

        // if the ISessionValidator signature is invalid, the userOp is invalid
        if (!validSig) return ERC4337_VALIDATION_FAILED;

        // In every Policy check, the ERC4337.ValidationData sigFailed required to be false, SmartSession validation
        // flow will only reach to this line, if all Policies return valid and ISessionValidator signature is valid.
        // Namera: the owner-signed session validity window bounds every user operation.
        return vd.intersect(_sessionValidityData(permissionId, account));
    }

    /**
     * @notice SessionKey ERC-1271 signature validation
     * this function implements the ERC-1271 forwarding function defined by ERC-7579
     * SessionKeys can be used to sign messages and validate ERC-1271 on behalf of Accounts
     * In order to validate a signature, the signature must be wrapped with ERC-7739
     * @param sender The address of ERC-1271 sender
     * @param hash The hash of the message
     * @param signature The signature of the message
     *         signature is expected to be in the format:
     *         (PermissionId (32 bytes),
     *          ERC7739 (abi.encodePacked(signatureForSessionValidator,
     *                                    _DOMAIN_SEP_B,
     *                                    contents,
     *                                    contentsType,
     *                                    uint16(contentsType.length))
     */
    function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata signature)
        external
        view
        override
        returns (bytes4 result)
    {
        // ERC-7739 support detection. 0x77390002 marks the version that binds signatures to `hash`
        // (upstream SmartSession reports 0x77390001).
        if (hash == 0x7739773977397739773977397739773977397739773977397739773977397739) {
            return bytes4(0x77390002);
        }
        // disallow that session can be authorized by other sessions
        if (sender == address(this)) return EIP1271_FAILED;

        bool success = _erc1271IsValidSignatureViaNestedEIP712(
            sender, hash, _erc1271UnwrapSignature(signature)
        );
        /// @solidity memory-safe-assembly
        assembly {
            // `success ? bytes4(keccak256("isValidSignature(bytes32,bytes)")) : 0xffffffff`.
            // We use `0xffffffff` for invalid, in convention with the reference implementation.
            result := shl(224, or(0x1626ba7e, sub(0, iszero(success))))
        }
    }

    /**
     * @notice Validates an ERC-1271 signature with additional ERC-7739 content checks
     * @dev This function performs several checks to validate the signature:
     *      1. Verifies that the permissionId is enabled for the sender
     *      2. Ensures the ERC-7739 content is enabled for the given permissionId
     *      3. Checks the ERC-1271 policy
     *      4. Validates the signature using ISessionValidator
     * @dev This function returns false if a permissionId supplied within the signature is not enabled
     * @dev This function returns false if the ERC-7739 content is not enabled for the given permissionId
     * @param sender The address initiating the signature validation
     * @param hash The hash of the data to be signed
     * @param signature The signature to be validated (first 32 bytes contain the permissionId)
     * @param contents The ERC-7739 content to be validated
     * @return valid Boolean indicating whether the signature is valid
     */
    // Session expiry is time-based by design (see _isWithinSessionValidity).
    // slither-disable-next-line timestamp
    function _erc1271IsValidSignatureNowCalldata(
        address sender,
        bytes32 hash,
        bytes calldata signature,
        bytes32 appDomainSeparator,
        bytes calldata contents
    ) internal view virtual override returns (bool) {
        bytes32 contentHash = string(contents).hashERC7739Content();
        // isolate the PermissionId and actual signature from the supplied signature param
        PermissionId permissionId = PermissionId.wrap(bytes32(signature[0:32]));
        signature = signature[32:];

        // forgefmt: disable-next-item
        if (
            // return false if the permissionId is not enabled
            !$enabledSessions.contains(msg.sender, PermissionId.unwrap(permissionId))
            // Namera: return false outside the owner-signed session validity window
            || !_isWithinSessionValidity(permissionId, msg.sender)
            // return false if the content is not enabled
            || !$enabledERC7739.enabledContentNames[permissionId][appDomainSeparator].contains(msg.sender, contentHash)
        ) return false;

        // check the ERC-1271 policy
        bool valid = $erc1271Policies.checkERC1271({
            account: msg.sender,
            requestSender: sender,
            hash: hash,
            signature: signature,
            permissionId: permissionId,
            configId: permissionId.toErc1271PolicyId().toConfigId(),
            minPoliciesToEnforce: 1
        });

        // if the erc1271 policy check failed, return false
        if (!valid) return valid;
        // this call reverts if the ISessionValidator is not set
        return $sessionValidators.isValidISessionValidator({
            hash: hash, account: msg.sender, permissionId: permissionId, signature: signature
        });
    }
}
