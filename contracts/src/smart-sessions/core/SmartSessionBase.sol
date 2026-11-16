// SPDX-License-Identifier: AGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import "../DataTypes.sol";
import {ISmartSession} from "../ISmartSession.sol";
import {ConfigLib} from "../lib/ConfigLib.sol";
import {FlatBytesLib} from "../lib/FlatBytesLib.sol";
import {HashLib} from "../lib/HashLib.sol";
import {IdLib} from "../lib/IdLib.sol";
import {PolicyLib} from "../lib/PolicyLib.sol";
import {EnumerableSet} from "../utils/EnumerableSet4337.sol";

/// @notice Session storage, session management, module lifecycle and views.
/// @dev All storage is keyed by the account (`msg.sender` for writes), so reads during ERC-4337 validation stay
/// within ERC-7562 associated storage.
abstract contract SmartSessionBase is ISmartSession {
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableSet for EnumerableSet.AddressSet;
    using HashLib for *;
    using PolicyLib for *;
    using ConfigLib for *;
    using IdLib for *;
    using FlatBytesLib for FlatBytesLib.Bytes;

    Policy internal $userOpPolicies;
    Policy internal $erc1271Policies;
    EnumerableActionPolicy internal $actionPolicies;
    EnumerableSet.Bytes32Set internal $enabledSessions;
    EnumerableERC7739Config internal $enabledERC7739;
    mapping(PermissionId permissionId => mapping(address smartAccount => SignerConf conf)) internal
        $sessionValidators;
    mapping(
        PermissionId permissionId => mapping(address smartAccount => bool permitERC4337Paymaster)
    ) internal $permitERC4337Paymaster;
    mapping(
        PermissionId permissionId => mapping(address smartAccount => SessionValidity validity)
    ) internal $sessionValidity;
    /// @dev Enable-signature nonce; incrementing it invalidates signed but unused enable data.
    mapping(PermissionId permissionId => mapping(address smartAccount => uint256 nonce)) internal
        $signerNonce;

    /// @dev Requires the session to be enabled before and after the call, so policy initialization cannot remove
    /// it in between.
    modifier enableWithPermissionId(PermissionId permissionId) {
        $enabledSessions.requirePermissionIdEnabled(permissionId);
        _;
        $enabledSessions.requirePermissionIdEnabled(permissionId);
    }

    modifier disableWithPermissionId(PermissionId permissionId) {
        $enabledSessions.requirePermissionIdEnabled(permissionId);
        _;
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Session management
    // -----------------------------------------------------------------------------------------------------------------

    /// @notice Enables sessions for the calling account and returns their permission IDs.
    function enableSessions(Session[] calldata sessions)
        external
        returns (PermissionId[] memory permissionIds)
    {
        return _enableSessions(sessions);
    }

    /// @notice Adds or reconfigures user operation policies of an enabled session.
    function enableUserOpPolicies(PermissionId permissionId, PolicyData[] memory userOpPolicies)
        external
        enableWithPermissionId(permissionId)
    {
        $userOpPolicies.enable({
            policyType: PolicyType.USER_OP,
            permissionId: permissionId,
            configId: permissionId.toUserOpPolicyId().toConfigId(),
            policyDatas: userOpPolicies
        });
    }

    function disableUserOpPolicies(PermissionId permissionId, address[] calldata policies)
        external
        disableWithPermissionId(permissionId)
    {
        $userOpPolicies.disable({
            policyType: PolicyType.USER_OP,
            smartAccount: msg.sender,
            permissionId: permissionId,
            policies: policies
        });
    }

    /// @notice Adds ERC-7739 contents and ERC-1271 policies to an enabled session.
    function enableERC1271Policies(PermissionId permissionId, ERC7739Data calldata erc1271Policies)
        external
        enableWithPermissionId(permissionId)
    {
        $enabledERC7739.enable({
            contexts: erc1271Policies.allowedERC7739Content, permissionId: permissionId
        });
        $erc1271Policies.enable({
            policyType: PolicyType.ERC1271,
            permissionId: permissionId,
            configId: permissionId.toErc1271PolicyId().toConfigId(),
            policyDatas: erc1271Policies.erc1271Policies
        });
    }

    function disableERC1271Policies(
        PermissionId permissionId,
        address[] calldata policies,
        ERC7739Context[] calldata contexts
    ) external disableWithPermissionId(permissionId) {
        $enabledERC7739.disable(contexts, permissionId, msg.sender);
        $erc1271Policies.disable({
            policyType: PolicyType.ERC1271,
            smartAccount: msg.sender,
            permissionId: permissionId,
            policies: policies
        });
    }

    /// @notice Adds or reconfigures action policies of an enabled session.
    function enableActionPolicies(PermissionId permissionId, ActionData[] memory actionPolicies)
        external
        enableWithPermissionId(permissionId)
    {
        $actionPolicies.enable({permissionId: permissionId, actionPolicyDatas: actionPolicies});
    }

    /// @notice Disables an action and all of its policies.
    function disableActionId(PermissionId permissionId, ActionId actionId)
        external
        disableWithPermissionId(permissionId)
    {
        $actionPolicies.actionPolicies[actionId].policyList[permissionId].removeAll(msg.sender);
        // slither-disable-next-line unused-return
        $actionPolicies.enabledActionIds[permissionId].remove(msg.sender, ActionId.unwrap(actionId));
        emit ActionIdDisabled(permissionId, actionId, msg.sender);
    }

    /// @notice Disables some policies of an action; the action is disabled when none remain.
    function disableActionPolicies(
        PermissionId permissionId,
        ActionId actionId,
        address[] calldata policies
    ) external disableWithPermissionId(permissionId) {
        EnumerableSet.AddressSet storage $policies = $actionPolicies.actionPolicies[actionId]
            .policyList[permissionId];
        $actionPolicies.actionPolicies[actionId].disable({
            policyType: PolicyType.ACTION,
            smartAccount: msg.sender,
            permissionId: permissionId,
            policies: policies
        });

        if ($policies.length(msg.sender) == 0) {
            // slither-disable-next-line unused-return
            $actionPolicies.enabledActionIds[permissionId].remove(
                msg.sender, ActionId.unwrap(actionId)
            );
            emit ActionIdDisabled(permissionId, actionId, msg.sender);
        }
    }

    function setPermit4337Paymaster(PermissionId permissionId, bool enabled) external {
        $enabledSessions.requirePermissionIdEnabled(permissionId);
        _setPermit4337Paymaster(permissionId, enabled);
    }

    /// @notice Removes a session with its validator, policies, contents, paymaster flag and validity window, and
    /// revokes unused owner enable signatures for it on this chain.
    /// @dev Policy state is not wiped: re-enabling a policy re-initializes it (`initializeWithMultiplexer`).
    function removeSession(PermissionId permissionId) public {
        if (permissionId == EMPTY_PERMISSIONID) revert InvalidSession(permissionId);

        $userOpPolicies.policyList[permissionId].removeAll(msg.sender);
        $erc1271Policies.policyList[permissionId].removeAll(msg.sender);

        EnumerableSet.Bytes32Set storage $actionIds = $actionPolicies.enabledActionIds[permissionId];
        bytes32[] memory actionIds = $actionIds.values(msg.sender);
        for (uint256 i; i < actionIds.length; ++i) {
            $actionPolicies.actionPolicies[ActionId.wrap(
                    actionIds[i]
                )].policyList[permissionId].removeAll(msg.sender);
        }
        $actionIds.removeAll(msg.sender);

        $sessionValidators.disable({permissionId: permissionId, smartAccount: msg.sender});
        delete $permitERC4337Paymaster[permissionId][msg.sender];
        delete $sessionValidity[permissionId][msg.sender];

        // slither-disable-next-line unused-return
        $enabledSessions.remove({account: msg.sender, value: PermissionId.unwrap(permissionId)});
        $enabledERC7739.removeAll({permissionId: permissionId, smartAccount: msg.sender});
        // Otherwise an unused ENABLE signature for this session could enable it again.
        _revokeEnableSignature(permissionId);
        emit SessionRemoved(permissionId, msg.sender);
    }

    /// @notice Increments the enable nonce, invalidating signed but unused enable data for this permission.
    function revokeEnableSignature(PermissionId permissionId) external {
        _revokeEnableSignature(permissionId);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Module lifecycle
    // -----------------------------------------------------------------------------------------------------------------

    /// @notice Installs the module, optionally enabling sessions.
    /// @param data Empty, or `abi.encodePacked(enableMode, abi.encode(Session[]))`.
    function onInstall(bytes calldata data) external override {
        // Sessions left over from an earlier installation must be removed explicitly first; reinstalling must not
        // silently reactivate them.
        if ($enabledSessions.length(msg.sender) != 0) {
            revert SmartSessionModuleAlreadyInstalled(msg.sender);
        }
        if (data.length == 0) return;

        SmartSessionMode mode = SmartSessionMode(uint8(bytes1(data[:1])));
        if (!mode.isEnableMode()) revert InvalidMode();
        data = data[1:];

        // abi.decode(data, (Session[])) without copying to memory.
        Session[] calldata sessions;
        assembly ("memory-safe") {
            let dataPointer := add(data.offset, calldataload(data.offset))
            sessions.offset := add(dataPointer, 32)
            sessions.length := calldataload(dataPointer)
        }
        _enableSessions(sessions);
    }

    /// @notice Removes every session of the calling account.
    function onUninstall(bytes calldata) external override {
        uint256 count = $enabledSessions.length(msg.sender);
        for (uint256 i; i < count; ++i) {
            // removeSession shifts the set, so always remove the first entry.
            removeSession(PermissionId.wrap($enabledSessions.valueAt(msg.sender, 0)));
        }
    }

    function isInitialized(address smartAccount) external view override returns (bool) {
        return $enabledSessions.length(smartAccount) != 0;
    }

    function isModuleType(uint256 typeID) external pure override returns (bool) {
        return typeID == ERC7579_MODULE_TYPE_VALIDATOR;
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------------------------------------------------

    // Policies run with msg.sender = policy, so reentrancy from them cannot change this account's state.
    // slither-disable-next-line reentrancy-benign,reentrancy-events
    function _enableSessions(Session[] calldata sessions)
        internal
        returns (PermissionId[] memory permissionIds)
    {
        uint256 length = sessions.length;
        if (length == 0) revert InvalidData();

        permissionIds = new PermissionId[](length);
        for (uint256 i; i < length; ++i) {
            PermissionId permissionId = sessions[i].toPermissionId();
            permissionIds[i] = permissionId;
            // Policies called in earlier iterations run with msg.sender = policy, so a reentrant call cannot
            // change this account's state.
            // forge-lint: disable-next-line(reentrancy-events)
            emit SessionCreated(permissionId, msg.sender);
            _enableSession(permissionId, sessions[i]);
        }
    }

    /// @dev Records `session` for the calling account, then calls into its policies (checks-effects-interactions).
    /// An already set session validator is kept; policies that are enabled again are re-initialized.
    function _enableSession(PermissionId permissionId, Session memory session) internal {
        // slither-disable-next-line unused-return
        $enabledSessions.add(msg.sender, PermissionId.unwrap(permissionId));
        _setPermit4337Paymaster(permissionId, session.permitERC4337Paymaster);
        _setSessionValidity(permissionId, session.validAfter, session.validUntil);
        if (!_isISessionValidatorSet(permissionId, msg.sender)) {
            $sessionValidators.enable({
                permissionId: permissionId,
                sessionValidator: session.sessionValidator,
                sessionValidatorConfig: session.sessionValidatorInitData
            });
        }
        $enabledERC7739.enable(session.erc7739Policies.allowedERC7739Content, permissionId);

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

    function _revokeEnableSignature(PermissionId permissionId) internal {
        uint256 nonce = $signerNonce[permissionId][msg.sender]++;
        emit NonceIterated(permissionId, msg.sender, nonce + 1);
    }

    function _setPermit4337Paymaster(PermissionId permissionId, bool enabled) internal {
        $permitERC4337Paymaster[permissionId][msg.sender] = enabled;
        // Policies called in earlier iterations run with msg.sender = policy, so a reentrant call cannot
        // change this account's state.
        // forge-lint: disable-next-line(reentrancy-events)
        emit PermissionIdPermit4337Paymaster(permissionId, msg.sender, enabled);
    }

    function _setSessionValidity(PermissionId permissionId, uint48 validAfter, uint48 validUntil)
        internal
    {
        if (validUntil != 0 && validAfter >= validUntil) {
            revert InvalidSessionValidity(validAfter, validUntil);
        }
        $sessionValidity[permissionId][msg.sender] =
            SessionValidity({validAfter: validAfter, validUntil: validUntil});
        // Policies called in earlier iterations run with msg.sender = policy, so a reentrant call cannot
        // change this account's state.
        // forge-lint: disable-next-line(reentrancy-events)
        emit SessionValiditySet(permissionId, msg.sender, validAfter, validUntil);
    }

    /// @dev The validity window as ERC-4337 validation data, so the EntryPoint enforces it without this contract
    /// reading `TIMESTAMP` during validation (banned by ERC-7562).
    function _sessionValidityData(PermissionId permissionId, address account)
        internal
        view
        returns (ValidationData)
    {
        SessionValidity memory validity = $sessionValidity[permissionId][account];
        return ValidationData.wrap(
            (uint256(validity.validUntil) << 160) | (uint256(validity.validAfter) << 208)
        );
    }

    /// @dev Same bounds as the EntryPoint: `validAfter <= block.timestamp <= validUntil`, `validUntil = 0` = unbounded.
    // slither-disable-next-line timestamp
    function _isWithinSessionValidity(PermissionId permissionId, address account)
        internal
        view
        returns (bool)
    {
        SessionValidity memory validity = $sessionValidity[permissionId][account];
        // Session expiry is time-based by design.
        // forge-lint: disable-next-item(block-timestamp)
        if (block.timestamp < validity.validAfter) return false;
        // forge-lint: disable-next-item(block-timestamp)
        return validity.validUntil == 0 || block.timestamp <= validity.validUntil;
    }

    function _isISessionValidatorSet(PermissionId permissionId, address account)
        internal
        view
        returns (bool)
    {
        return address($sessionValidators[permissionId][account].sessionValidator) != address(0);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------------------------------------------------

    function getSessionDigest(
        PermissionId permissionId,
        address account,
        Session memory data,
        SmartSessionMode mode
    ) external view returns (bytes32) {
        return data.sessionDigest({
            account: account, mode: mode, nonce: $signerNonce[permissionId][account]
        });
    }

    function getPermissionId(Session calldata session) external pure returns (PermissionId) {
        return session.toPermissionId();
    }

    function getNonce(PermissionId permissionId, address account) external view returns (uint256) {
        return $signerNonce[permissionId][account];
    }

    function getSessionValidity(PermissionId permissionId, address account)
        external
        view
        returns (uint48 validAfter, uint48 validUntil)
    {
        SessionValidity memory validity = $sessionValidity[permissionId][account];
        return (validity.validAfter, validity.validUntil);
    }

    function getPermissionIDs(address account)
        external
        view
        returns (PermissionId[] memory permissionIds)
    {
        bytes32[] memory ids = $enabledSessions.values(account);
        assembly ("memory-safe") {
            permissionIds := ids
        }
    }

    function isPermissionEnabled(PermissionId permissionId, address account)
        external
        view
        returns (bool)
    {
        return $enabledSessions.contains(account, PermissionId.unwrap(permissionId));
    }

    function isISessionValidatorSet(PermissionId permissionId, address account)
        external
        view
        returns (bool)
    {
        return _isISessionValidatorSet(permissionId, account);
    }

    function getSessionValidatorAndConfig(address account, PermissionId permissionId)
        external
        view
        returns (address sessionValidator, bytes memory sessionValidatorData)
    {
        SignerConf storage $conf = $sessionValidators[permissionId][account];
        sessionValidator = address($conf.sessionValidator);
        sessionValidatorData = $conf.config.load();
    }

    /// @dev Takes full `PolicyData` (not addresses) so a `Session` can be checked directly.
    function areUserOpPoliciesEnabled(
        address account,
        PermissionId permissionId,
        PolicyData[] calldata userOpPolicies
    ) external view returns (bool) {
        return $userOpPolicies.areEnabled({
            permissionId: permissionId, smartAccount: account, policyDatas: userOpPolicies
        });
    }

    function areERC1271PoliciesEnabled(
        address account,
        PermissionId permissionId,
        PolicyData[] calldata erc1271Policies
    ) external view returns (bool) {
        return $erc1271Policies.areEnabled({
            permissionId: permissionId, smartAccount: account, policyDatas: erc1271Policies
        });
    }

    function areActionsEnabled(
        address account,
        PermissionId permissionId,
        ActionData[] calldata actions
    ) external view returns (bool) {
        return $actionPolicies.areEnabled({
            permissionId: permissionId, smartAccount: account, actionPolicyDatas: actions
        });
    }

    function isUserOpPolicyEnabled(address account, PermissionId permissionId, address policy)
        external
        view
        returns (bool)
    {
        return $userOpPolicies.policyList[permissionId].contains(account, policy);
    }

    function isERC1271PolicyEnabled(address account, PermissionId permissionId, address policy)
        external
        view
        returns (bool)
    {
        return $erc1271Policies.policyList[permissionId].contains(account, policy);
    }

    function isActionPolicyEnabled(
        address account,
        PermissionId permissionId,
        ActionId actionId,
        address policy
    ) external view returns (bool) {
        return $actionPolicies.actionPolicies[actionId].policyList[permissionId].contains(
            account, policy
        );
    }

    function isActionIdEnabled(address account, PermissionId permissionId, ActionId actionId)
        external
        view
        returns (bool)
    {
        return
            $actionPolicies.enabledActionIds[permissionId].contains(
                account, ActionId.unwrap(actionId)
            );
    }

    function isERC7739ContentEnabled(
        address account,
        PermissionId permissionId,
        bytes32 appDomainSeparator,
        string memory content
    ) external view returns (bool) {
        return $enabledERC7739.enabledContentNames[permissionId][appDomainSeparator].contains(
            account, content.hashERC7739Content()
        );
    }

    function getUserOpPolicies(address account, PermissionId permissionId)
        external
        view
        returns (address[] memory)
    {
        return $userOpPolicies.policyList[permissionId].values(account);
    }

    function getERC1271Policies(address account, PermissionId permissionId)
        external
        view
        returns (address[] memory)
    {
        return $erc1271Policies.policyList[permissionId].values(account);
    }

    function getActionPolicies(address account, PermissionId permissionId, ActionId actionId)
        external
        view
        returns (address[] memory)
    {
        return $actionPolicies.actionPolicies[actionId].policyList[permissionId].values(account);
    }

    function getEnabledActions(address account, PermissionId permissionId)
        external
        view
        returns (bytes32[] memory)
    {
        return $actionPolicies.enabledActionIds[permissionId].values(account);
    }

    function getEnabledERC7739Content(address account, PermissionId permissionId)
        external
        view
        returns (ERC7739ContextHashes[] memory contents)
    {
        bytes32[] memory domainSeparators =
            $enabledERC7739.enabledDomainSeparators[permissionId].values(account);
        contents = new ERC7739ContextHashes[](domainSeparators.length);
        for (uint256 i; i < domainSeparators.length; ++i) {
            contents[i].appDomainSeparator = domainSeparators[i];
            contents[i].contentNameHashes = $enabledERC7739.enabledContentNames[permissionId][domainSeparators[i]].values(
                account
            );
        }
    }
}
