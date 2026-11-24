// SPDX-License-Identifier: AGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import {LibCall} from "solady/utils/LibCall.sol";

import {
    ActionData,
    ActionId,
    ConfigId,
    ERC1271Request,
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
import {I1271TypedDataPolicy, IActionPolicy} from "../interfaces/IPolicy.sol";
import {EnumerableSet} from "../utils/EnumerableSet4337.sol";
import {Execution, ExecutionLib} from "./ExecutionLib.sol";
import {IdLib} from "./IdLib.sol";
import {ValidationDataLib} from "./ValidationDataLib.sol";

/// @notice Runs policy checks for user operations, actions and ERC-1271 signatures.
library PolicyLib {
    using EnumerableSet for EnumerableSet.AddressSet;
    using ExecutionLib for bytes;
    using IdLib for *;
    using PolicyLib for *;
    using ValidationDataLib for ValidationData;

    /// @dev Mask of the ERC-4337 aggregator / sigFailed bits. Policies may only return time bounds.
    uint256 private constant AGGREGATOR_MASK = type(uint160).max;
    /// @dev EntryPoint v0.7 and v0.8: a call there moves the account's deposit (`withdrawTo`).
    address private constant ENTRY_POINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address private constant ENTRY_POINT_V08 = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;
    /// @dev Gas for each account probe: `isModuleInstalled` costs ~4k on Kernel, Nexus and Safe7579 (running out
    /// counts as installed, failing closed); `getDefaultValidator` far less where it exists.
    uint256 private constant PROBE_GAS = 100_000;
    uint256 private constant DEFAULT_VALIDATOR_PROBE_GAS = 30_000;

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
        (bool success, bool exceededMaxCopy, bytes memory returnData) = LibCall.tryCall({
            target: policy,
            value: 0,
            gasStipend: type(uint256).max,
            maxCopy: 32,
            data: callOnIPolicy
        });
        uint256 result;
        assembly ("memory-safe") {
            if iszero(success) {
                mstore(0, 0xf4270752) // `PolicyCheckReverted(bytes32)`.
                mstore(0x20, mload(add(returnData, 0x20)))
                revert(0x1c, 0x24)
            }
            result := mload(add(returnData, 0x20))
        }
        // Return data that is not exactly one word (e.g. a policy without the function, or one returning more, whose
        // copy was cut to one word) must not read as valid.
        if (exceededMaxCopy || returnData.length != 32 || result & AGGREGATOR_MASK != 0) {
            revert ISmartSession.PolicyViolation(permissionId, policy);
        }
        vd = ValidationData.wrap(result);
    }

    /// @dev Checks one ERC-7579 execution against its action policies, falling back to the fallback action's
    /// policies when the action has none. Calls into this module use their own sentinel action, so a session key
    /// can only reconfigure sessions if the owner allowed it explicitly. Calls on the account itself (module
    /// installs, upgrades, owner changes) never use the fallback and need their own action.
    function checkSingle7579Exec(
        mapping(ActionId => Policy) storage $policies,
        PermissionId permissionId,
        address target,
        uint256 value,
        bytes calldata callData,
        uint256 minPolicies
    ) internal returns (ValidationData vd) {
        bytes4 selector = callData.length < 4 ? IdLib.VALUE_SELECTOR : bytes4(callData[:4]);
        // Namera: only empty calldata is a plain value transfer; calldata of 1 to 3 bytes, or starting with the
        // value selector, would reach the target's code under the value transfer's action.
        if (selector == IdLib.VALUE_SELECTOR && callData.length != 0) {
            revert ISmartSession.InvalidTarget();
        }

        // A nested execute on the account would bypass the policies of the inner calls.
        if (selector == ERC7579_EXECUTE_SELECTOR && target == msg.sender) {
            revert ISmartSession.InvalidSelfCall();
        }
        if (target == FALLBACK_TARGET_FLAG) revert ISmartSession.InvalidTarget();

        ActionId actionId;
        if (target == address(this)) {
            actionId = FALLBACK_ACTIONID_SMARTSESSION_CALL;
        } else {
            actionId = target.toActionId(selector);
            if (target != msg.sender) {
                vd = $policies[actionId].tryCheck({
                    permissionId: permissionId,
                    callOnIPolicy: abi.encodeCall(
                        IActionPolicy.checkAction,
                        (permissionId.toConfigId(actionId), msg.sender, target, value, callData)
                    ),
                    minPolicies: minPolicies
                });
                if (!(vd == RETRY_WITH_FALLBACK)) return vd;
                // Namera: the fallback never reaches the account's infrastructure (see `_isInfrastructure`).
                if (_isInfrastructure(target)) revert ISmartSession.InvalidTarget();
                actionId = FALLBACK_ACTIONID;
            }
        }

        // Reverts if this action (or the fallback action) has no policies.
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
        bytes calldata executeCallData,
        PermissionId permissionId,
        uint256 minPolicies
    ) internal returns (ValidationData vd) {
        Execution[] calldata executions = executeCallData.decodeUserOpCallData().decodeBatch();
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

    /// @dev True if all ERC-1271 policies (at least `minPoliciesToEnforce`) accept the signed request. Namera:
    /// a policy that reports `I1271TypedDataPolicy` is given the signed typed data instead of the hash.
    function checkERC1271(
        Policy storage $self,
        address account,
        ERC1271Request memory request,
        bytes calldata signature,
        PermissionId permissionId,
        ConfigId configId,
        uint256 minPoliciesToEnforce
    ) internal view returns (bool) {
        address[] memory policies = $self.policyList[permissionId].values(account);
        uint256 length = policies.length;
        if (minPoliciesToEnforce > length) revert ISmartSession.NoPoliciesSet(permissionId);

        for (uint256 i; i < length; ++i) {
            if (!_accepts(I1271TypedDataPolicy(policies[i]), account, request, signature, configId))
            {
                return false;
            }
        }
        return true;
    }

    /// @dev True if every policy in `policyDatas` is enabled (vacuously true for none).
    function areEnabled(
        Policy storage $policies,
        PermissionId permissionId,
        address account,
        PolicyData[] calldata policyDatas
    ) internal view returns (bool) {
        uint256 length = policyDatas.length;
        for (uint256 i; i < length; ++i) {
            if (!$policies.policyList[permissionId].contains(account, policyDatas[i].policy)) {
                return false;
            }
        }
        return true;
    }

    /// @dev True if every policy of every action in `actionPolicyDatas` is enabled.
    function areEnabled(
        EnumerableActionPolicy storage $self,
        PermissionId permissionId,
        address account,
        ActionData[] calldata actionPolicyDatas
    ) internal view returns (bool) {
        uint256 length = actionPolicyDatas.length;
        for (uint256 i; i < length; ++i) {
            ActionData calldata action = actionPolicyDatas[i];
            ActionId actionId = action.actionTarget.toActionId(action.actionTargetSelector);
            if (!$self.actionPolicies[actionId].areEnabled(
                    permissionId, account, action.actionPolicies
                )) return false;
        }
        return true;
    }

    /// @dev Whether `policy` accepts the signed request, given the typed data when it reads it.
    function _accepts(
        I1271TypedDataPolicy policy,
        address account,
        ERC1271Request memory request,
        bytes calldata signature,
        ConfigId configId
    ) private view returns (bool) {
        if (policy.supportsInterface(type(I1271TypedDataPolicy).interfaceId)) {
            return policy.check1271TypedData({
                id: configId,
                requestSender: request.requestSender,
                account: account,
                appDomainSeparator: request.appDomainSeparator,
                contentsData: request.contentsData,
                policyData: request.policyData
            });
        }
        return policy.check1271SignedAction({
            id: configId,
            requestSender: request.requestSender,
            account: account,
            hash: request.hash,
            signature: signature
        });
    }

    /// @dev Whether `target` is part of the calling account's own infrastructure: the EntryPoint, a validator, executor
    /// or hook the account has installed, or its default validator (Nexus). Modules take the account's calls as its
    /// own configuration (owners, passkeys, hook installs), so a fallback call there could take the account over.
    /// Calls to them need an explicit action. A failed module probe counts as installed, failing closed. Fallback
    /// handlers (type 3) are installed per selector, which a probe without one can't ask about (Kernel and Safe7579
    /// revert), so they aren't covered.
    function _isInfrastructure(address target) private view returns (bool) {
        if (target == ENTRY_POINT_V07 || target == ENTRY_POINT_V08) return true;
        // Validators (1), executors (2) and hooks (4). Copies at most one word back: the answer is one.
        for (uint256 moduleType = 1; moduleType <= 4; ++moduleType) {
            if (moduleType == 3) continue;
            (bool success, bool exceeded, bytes memory result) = LibCall.tryStaticCall({
                target: msg.sender,
                gasStipend: PROBE_GAS,
                maxCopy: 32,
                data: abi.encodeWithSignature(
                    "isModuleInstalled(uint256,address,bytes)", moduleType, target, ""
                )
            });
            if (!success || exceeded || result.length != 32 || abi.decode(result, (bool))) {
                return true;
            }
        }
        // Nexus keeps its owner in a default validator it doesn't report as installed. A bounded probe: on an account
        // without it (Safe7579), the call falls into a fallback that burns its gas.
        (bool found, bool longer, bytes memory defaultValidator) = LibCall.tryStaticCall({
            target: msg.sender,
            gasStipend: DEFAULT_VALIDATOR_PROBE_GAS,
            maxCopy: 32,
            data: abi.encodeWithSignature("getDefaultValidator()")
        });
        return found && !longer && defaultValidator.length == 32
            && abi.decode(defaultValidator, (address)) == target;
    }
}
