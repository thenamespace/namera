// SPDX-License-Identifier: AGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import {
    ActionData,
    ActionId,
    ConfigId,
    ERC7579_EXECUTE_SELECTOR,
    EnumerableActionPolicy,
    FALLBACK_ACTIONID,
    FALLBACK_ACTIONID_SMARTSESSION_CALL,
    FALLBACK_TARGET_FLAG,
    PermissionId,
    Policy,
    PolicyData,
    RETRY_WITH_FALLBACK,
    ValidationData
} from "../DataTypes.sol";
import {ISmartSession} from "../ISmartSession.sol";
import {I1271Policy, IActionPolicy} from "../interfaces/IPolicy.sol";
import {EnumerableSet} from "../utils/EnumerableSet4337.sol";
import {Execution, ExecutionLib} from "./ExecutionLib.sol";
import {IdLib} from "./IdLib.sol";
import {ValidationDataLib} from "./ValidationDataLib.sol";
import {ERC4337} from "solady/accounts/ERC4337.sol";
import {LibCall} from "solady/utils/LibCall.sol";

/// @notice Runs policy checks for user operations, actions and ERC-1271 signatures.
library PolicyLib {
    using EnumerableSet for EnumerableSet.AddressSet;
    using ExecutionLib for bytes;
    using IdLib for *;
    using PolicyLib for *;
    using ValidationDataLib for ValidationData;

    /// @dev Mask of the ERC-4337 aggregator / sigFailed bits. Policies may only return time bounds.
    uint256 private constant AGGREGATOR_MASK = type(uint160).max;

    /// @dev Calls every policy of `permissionId` with `callOnIPolicy` and intersects their validation data.
    /// Reverts with `NoPoliciesSet` if fewer than `minPolicies` are set.
    function check(
        Policy storage $self,
        PermissionId permissionId,
        bytes memory callOnIPolicy,
        uint256 minPolicies
    ) internal returns (ValidationData vd) {
        vd = $self.tryCheck(permissionId, callOnIPolicy, minPolicies);
        if (vd == RETRY_WITH_FALLBACK) revert ISmartSession.NoPoliciesSet(permissionId);
    }

    /// @dev Like `check`, but returns `RETRY_WITH_FALLBACK` instead of reverting when fewer than `minPolicies`
    /// are set, so the caller can fall back to the fallback action's policies.
    function tryCheck(
        Policy storage $self,
        PermissionId permissionId,
        bytes memory callOnIPolicy,
        uint256 minPolicies
    ) internal returns (ValidationData vd) {
        address[] memory policies = $self.policyList[permissionId].values(msg.sender);
        uint256 length = policies.length;
        if (minPolicies > length) return RETRY_WITH_FALLBACK;

        for (uint256 i; i < length; ++i) {
            vd = vd.intersect(policies[i].callPolicy(permissionId, callOnIPolicy));
        }
        // Policies cannot change the control flow by producing the sentinel.
        if (vd == RETRY_WITH_FALLBACK) revert ISmartSession.ForbiddenValidationData();
    }

    /// @dev Calls one policy, forwarding all gas and copying at most 32 bytes of return data. Reverts with
    /// `PolicyCheckReverted(bytes32)` if the policy reverts and with `PolicyViolation` if it fails validation or
    /// sets an aggregator.
    function callPolicy(address policy, PermissionId permissionId, bytes memory callOnIPolicy)
        internal
        returns (ValidationData vd)
    {
        // `type(uint256).max` gas forwards all remaining gas (EIP-150) without reading GAS, which ERC-7562
        // restricts during validation.
        (bool success,, bytes memory returnData) = LibCall.tryCall({
            target: policy,
            value: 0,
            gasStipend: type(uint256).max,
            maxCopy: 32,
            data: callOnIPolicy
        });
        uint256 result;
        assembly ("memory-safe") {
            if iszero(success) {
                mstore(0, 0xf4270752) // `PolicyCheckReverted(bytes32)`
                mstore(0x20, mload(add(returnData, 0x20)))
                revert(0x1c, 0x24)
            }
            result := mload(add(returnData, 0x20))
        }
        if (result & AGGREGATOR_MASK != 0) {
            revert ISmartSession.PolicyViolation(permissionId, policy);
        }
        vd = ValidationData.wrap(result);
    }

    /// @dev Checks one ERC-7579 execution against its action policies, falling back to the fallback action's
    /// policies when the action has none. Calls into this module use their own sentinel action, so a session key
    /// can only reconfigure sessions if the owner allowed it explicitly.
    function checkSingle7579Exec(
        mapping(ActionId => Policy) storage $policies,
        PermissionId permissionId,
        address target,
        uint256 value,
        bytes calldata callData,
        uint256 minPolicies
    ) internal returns (ValidationData vd) {
        bytes4 targetSig = callData.length < 4 ? IdLib.VALUE_SELECTOR : bytes4(callData[:4]);

        // A nested execute on the account would bypass the policies of the inner calls.
        if (targetSig == ERC7579_EXECUTE_SELECTOR && target == msg.sender) {
            revert ISmartSession.InvalidSelfCall();
        }
        if (target == FALLBACK_TARGET_FLAG) revert ISmartSession.InvalidTarget();

        ActionId actionId;
        if (target == address(this)) {
            actionId = FALLBACK_ACTIONID_SMARTSESSION_CALL;
        } else {
            actionId = target.toActionId(targetSig);
            vd = $policies[actionId].tryCheck({
                permissionId: permissionId,
                callOnIPolicy: abi.encodeCall(
                    IActionPolicy.checkAction,
                    (permissionId.toConfigId(actionId), msg.sender, target, value, callData)
                ),
                minPolicies: minPolicies
            });
            if (!(vd == RETRY_WITH_FALLBACK)) return vd;
            actionId = FALLBACK_ACTIONID;
        }

        // Reverts if the fallback action has no policies either.
        return $policies[actionId].check({
            permissionId: permissionId,
            callOnIPolicy: abi.encodeCall(
                IActionPolicy.checkAction,
                (permissionId.toConfigId(actionId), msg.sender, target, value, callData)
            ),
            minPolicies: minPolicies
        });
    }

    /// @dev Checks every execution of an ERC-7579 batch and intersects the results.
    function checkBatch7579Exec(
        mapping(ActionId => Policy) storage $policies,
        ERC4337.PackedUserOperation calldata userOp,
        PermissionId permissionId,
        uint256 minPolicies
    ) internal returns (ValidationData vd) {
        Execution[] calldata executions = userOp.callData.decodeUserOpCallData().decodeBatch();
        uint256 length = executions.length;
        if (length == 0) revert ISmartSession.NoExecutionsInBatch();

        for (uint256 i; i < length; ++i) {
            Execution calldata execution = executions[i];
            vd = vd.intersect(
                checkSingle7579Exec({
                    $policies: $policies,
                    permissionId: permissionId,
                    target: execution.target,
                    value: execution.value,
                    callData: execution.callData,
                    minPolicies: minPolicies
                })
            );
        }
    }

    /// @dev True if all ERC-1271 policies (at least `minPoliciesToEnforce`) accept the signed request.
    function checkERC1271(
        Policy storage $self,
        address account,
        address requestSender,
        bytes32 hash,
        bytes calldata signature,
        PermissionId permissionId,
        ConfigId configId,
        uint256 minPoliciesToEnforce
    ) internal view returns (bool) {
        address[] memory policies = $self.policyList[permissionId].values(account);
        uint256 length = policies.length;
        if (minPoliciesToEnforce > length) revert ISmartSession.NoPoliciesSet(permissionId);

        for (uint256 i; i < length; ++i) {
            if (!I1271Policy(policies[i]).check1271SignedAction({
                    id: configId,
                    requestSender: requestSender,
                    account: account,
                    hash: hash,
                    signature: signature
                })) return false;
        }
        return true;
    }

    /// @dev True if every policy in `policyDatas` is enabled (vacuously true for none).
    function areEnabled(
        Policy storage $policies,
        PermissionId permissionId,
        address smartAccount,
        PolicyData[] calldata policyDatas
    ) internal view returns (bool) {
        uint256 length = policyDatas.length;
        for (uint256 i; i < length; ++i) {
            if (!$policies.policyList[permissionId].contains(smartAccount, policyDatas[i].policy)) {
                return false;
            }
        }
        return true;
    }

    /// @dev True if every policy of every action in `actionPolicyDatas` is enabled.
    function areEnabled(
        EnumerableActionPolicy storage $self,
        PermissionId permissionId,
        address smartAccount,
        ActionData[] calldata actionPolicyDatas
    ) internal view returns (bool) {
        uint256 length = actionPolicyDatas.length;
        for (uint256 i; i < length; ++i) {
            ActionData calldata action = actionPolicyDatas[i];
            ActionId actionId = action.actionTarget.toActionId(action.actionTargetSelector);
            if (!$self.actionPolicies[actionId].areEnabled(
                    permissionId, smartAccount, action.actionPolicies
                )) return false;
        }
        return true;
    }
}
