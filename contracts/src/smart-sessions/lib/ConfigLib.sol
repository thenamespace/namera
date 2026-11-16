// SPDX-License-Identifier: AGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import {
    ActionData,
    ActionId,
    ConfigId,
    EMPTY_ACTIONID,
    EMPTY_PERMISSIONID,
    ERC7579_MODULE_TYPE_STATELESS_VALIDATOR,
    ERC7739Context,
    EnumerableActionPolicy,
    EnumerableERC7739Config,
    PermissionId,
    Policy,
    PolicyData,
    PolicyType,
    SignerConf
} from "../DataTypes.sol";
import {ISmartSession} from "../ISmartSession.sol";
import {I1271Policy, IActionPolicy, IPolicy, IUserOpPolicy} from "../interfaces/IPolicy.sol";
import {ISessionValidator} from "../interfaces/ISessionValidator.sol";
import {EnumerableSet} from "../utils/EnumerableSet4337.sol";
import {FlatBytesLib} from "./FlatBytesLib.sol";
import {HashLib} from "./HashLib.sol";
import {IdLib} from "./IdLib.sol";

/// @notice Enables, disables and reads session configuration: policies, ERC-7739 contents and session validators.
library ConfigLib {
    using FlatBytesLib for FlatBytesLib.Bytes;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using HashLib for string;
    using IdLib for *;
    using ConfigLib for *;

    /// @dev Reverts unless `policy` reports support (ERC-165) for the interface of `policyType`.
    function requirePolicyType(address policy, PolicyType policyType) internal view {
        bytes4 interfaceId;
        if (policyType == PolicyType.USER_OP) interfaceId = type(IUserOpPolicy).interfaceId;
        else if (policyType == PolicyType.ACTION) interfaceId = type(IActionPolicy).interfaceId;
        else if (policyType == PolicyType.ERC1271) interfaceId = type(I1271Policy).interfaceId;
        else revert ISmartSession.UnsupportedPolicy(policy);

        if (!IPolicy(policy).supportsInterface(interfaceId)) {
            revert ISmartSession.UnsupportedPolicy(policy);
        }
    }

    /// @dev Reverts unless `permissionId` is enabled for the calling account.
    function requirePermissionIdEnabled(
        EnumerableSet.Bytes32Set storage set,
        PermissionId permissionId
    ) internal view {
        if (!set.contains(msg.sender, PermissionId.unwrap(permissionId))) {
            revert ISmartSession.InvalidPermissionId(permissionId);
        }
    }

    /// @dev Enables policies for a given permission ID: checks the policy interface, adds it to the policy list,
    /// initializes it (overwriting any previous configuration) and emits an event.
    /// @param $policy The storage reference to the Policy struct.
    /// @param policyType The type of policy being enabled.
    /// @param permissionId The identifier of the permission for which policies are being enabled.
    /// @param configId The configuration ID associated with the permission and policy type.
    /// @param policyDatas Policy addresses and initialization data.
    function enable(
        Policy storage $policy,
        PolicyType policyType,
        PermissionId permissionId,
        ConfigId configId,
        PolicyData[] memory policyDatas
    ) internal {
        uint256 lengthConfigs = policyDatas.length;
        for (uint256 i; i < lengthConfigs; ++i) {
            address policy = policyDatas[i].policy;

            policy.requirePolicyType(policyType);

            // slither-disable-next-line unused-return
            $policy.policyList[permissionId].add({account: msg.sender, value: policy});
            // Policies called in earlier iterations run with msg.sender = policy, so a reentrant call cannot
            // change this account's state.
            // forge-lint: disable-next-line(reentrancy-events)
            emit ISmartSession.PolicyEnabled(permissionId, policyType, policy, msg.sender);

            IPolicy(policy).initializeWithMultiplexer({
                account: msg.sender, configId: configId, initData: policyDatas[i].initData
            });
        }
    }

    /// @dev Enables action policies for a given permission ID and records every enabled action ID.
    /// @param $self The storage reference to the EnumerableActionPolicy struct.
    /// @param permissionId The identifier of the permission for which action policies are being enabled.
    /// @param actionPolicyDatas Action targets, selectors and their policies.
    function enable(
        EnumerableActionPolicy storage $self,
        PermissionId permissionId,
        ActionData[] memory actionPolicyDatas
    ) internal {
        if (permissionId == EMPTY_PERMISSIONID) {
            revert ISmartSession.InvalidPermissionId(permissionId);
        }
        uint256 length = actionPolicyDatas.length;
        for (uint256 i; i < length; ++i) {
            ActionData memory actionPolicyData = actionPolicyDatas[i];
            address target = actionPolicyData.actionTarget;
            ActionId actionId = target.toActionId(actionPolicyData.actionTargetSelector);

            // disallow actions to be set for address(0) or to the smartsession module itself
            // sessionkeys that have access to smartsessions, may use this access to elevate their privileges
            if (target == address(0) || target == address(this) || actionId == EMPTY_ACTIONID) {
                revert ISmartSession.InvalidActionId();
            }

            $self.actionPolicies[actionId].enable({
                policyType: PolicyType.ACTION,
                permissionId: permissionId,
                configId: permissionId.toConfigId(actionId),
                policyDatas: actionPolicyData.actionPolicies
            });

            // slither-disable-next-line unused-return
            $self.enabledActionIds[permissionId].add(msg.sender, ActionId.unwrap(actionId));
        }
    }

    /// @dev Enables ERC-7739 contents (per app domain separator) for a permission of the calling account.
    function enable(
        EnumerableERC7739Config storage $enabledERC7739,
        ERC7739Context[] memory contexts,
        PermissionId permissionId
    ) internal {
        uint256 length = contexts.length;
        for (uint256 i; i < length; ++i) {
            bytes32 appDomainSeparator = contexts[i].appDomainSeparator;

            uint256 contentNamesLength = contexts[i].contentNames.length;
            if (contentNamesLength != 0) {
                $enabledERC7739.enabledDomainSeparators[permissionId].add(
                    msg.sender, appDomainSeparator
                );
            }
            for (uint256 y; y < contentNamesLength; ++y) {
                bytes32 contentHash = contexts[i].contentNames[y].hashERC7739Content();
                $enabledERC7739.enabledContentNames[permissionId][appDomainSeparator].add(
                    msg.sender, contentHash
                );
            }
        }
    }

    /// @dev Sets the ISessionValidator and its configuration for a permission of the calling account.
    function enable(
        mapping(
            PermissionId permissionId => mapping(address smartAccount => SignerConf conf)
        ) storage $sessionValidators,
        PermissionId permissionId,
        ISessionValidator sessionValidator,
        bytes memory sessionValidatorConfig
    ) internal {
        if (
            address(sessionValidator) == address(0)
                || !sessionValidator.isModuleType(ERC7579_MODULE_TYPE_STATELESS_VALIDATOR)
        ) {
            revert ISmartSession.InvalidISessionValidator(sessionValidator);
        }

        SignerConf storage $conf = $sessionValidators[permissionId][msg.sender];
        $conf.sessionValidator = sessionValidator;
        $conf.config.store(sessionValidatorConfig);
        emit ISmartSession.SessionValidatorEnabled(
            permissionId, address(sessionValidator), msg.sender
        );
    }

    /// @dev Disables policies for a given permission ID and smart account.
    /// @notice Cleaning state on policies is not required as on enable, initializeWithMultiplexer is called which MUST
    ///       overwrite the current state.
    function disable(
        Policy storage $policy,
        PolicyType policyType,
        address smartAccount,
        PermissionId permissionId,
        address[] calldata policies
    ) internal {
        uint256 length = policies.length;
        for (uint256 i; i < length; ++i) {
            address policy = policies[i];
            if ($policy.policyList[permissionId].remove(smartAccount, policy)) {
                emit ISmartSession.PolicyDisabled(permissionId, policyType, policy, smartAccount);
            }
        }
    }

    function disable(
        mapping(
            PermissionId permissionId => mapping(address smartAccount => SignerConf conf)
        ) storage $sessionValidators,
        PermissionId permissionId,
        address smartAccount
    ) internal {
        SignerConf storage $conf = $sessionValidators[permissionId][smartAccount];
        emit ISmartSession.SessionValidatorDisabled(
            permissionId, address($conf.sessionValidator), smartAccount
        );
        delete $conf.sessionValidator;
        $conf.config.clear();
    }

    function disable(
        EnumerableERC7739Config storage $enabledERC7739,
        ERC7739Context[] memory contexts,
        PermissionId permissionId,
        address smartAccount
    ) internal {
        uint256 length = contexts.length;
        for (uint256 i; i < length; ++i) {
            bytes32 appDomainSeparator = contexts[i].appDomainSeparator;
            EnumerableSet.Bytes32Set storage $contentNames =
                $enabledERC7739.enabledContentNames[permissionId][appDomainSeparator];

            uint256 contentNamesLength = contexts[i].contentNames.length;
            for (uint256 y; y < contentNamesLength; ++y) {
                $contentNames.remove(smartAccount, contexts[i].contentNames[y].hashERC7739Content());
            }

            if ($contentNames.length(smartAccount) == 0) {
                $enabledERC7739.enabledDomainSeparators[permissionId].remove(
                    smartAccount, appDomainSeparator
                );
            }
        }
    }

    function removeAll(
        EnumerableERC7739Config storage $enabledERC7739,
        PermissionId permissionId,
        address smartAccount
    ) internal {
        bytes32[] memory domainSeparators = $enabledERC7739.enabledDomainSeparators[permissionId].values(
            smartAccount
        );
        uint256 length = domainSeparators.length;
        for (uint256 i; i < length; ++i) {
            $enabledERC7739.enabledContentNames[permissionId][domainSeparators[i]].removeAll(
                smartAccount
            );
        }
        $enabledERC7739.enabledDomainSeparators[permissionId].removeAll(smartAccount);
    }

    /// @dev Validates `signature` over `hash` with the session validator of `permissionId` for `account`.
    /// Reverts if no session validator is set.
    function isValidISessionValidator(
        mapping(PermissionId => mapping(address => SignerConf)) storage $sessionValidators,
        bytes32 hash,
        address account,
        PermissionId permissionId,
        bytes memory signature
    ) internal view returns (bool) {
        SignerConf storage $conf = $sessionValidators[permissionId][account];
        ISessionValidator sessionValidator = $conf.sessionValidator;
        if (address(sessionValidator) == address(0)) {
            revert ISmartSession.SignerNotFound(permissionId, account);
        }
        return sessionValidator.validateSignatureWithData({
            hash: hash, sig: signature, data: $conf.config.load()
        });
    }
}
