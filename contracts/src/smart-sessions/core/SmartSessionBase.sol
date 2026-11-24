// SPDX-License-Identifier: AGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import {
    ActionData,
    ActionId,
    EMPTY_PERMISSIONID,
    ERC7579_MODULE_TYPE_VALIDATOR,
    ERC7739Context,
    ERC7739ContextHashes,
    ERC7739Data,
    EnumerableActionPolicy,
    EnumerableERC7739Config,
    PermissionId,
    Policy,
    PolicyData,
    PolicyType,
    Session,
    SessionValidity,
    SignerConf,
    SmartSessionMode,
    ValidationData
} from "../DataTypes.sol";
import {ISmartSession} from "../ISmartSession.sol";
import {ConfigLib} from "../lib/ConfigLib.sol";
import {FlatBytesLib} from "../lib/FlatBytesLib.sol";
import {HashLib} from "../lib/HashLib.sol";
import {IdLib} from "../lib/IdLib.sol";
import {PolicyLib} from "../lib/PolicyLib.sol";
import {SupportedAccount} from "../lib/SupportedAccount.sol";
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
    mapping(PermissionId permissionId => mapping(address account => SignerConf conf)) internal
        $sessionValidators;
    mapping(
        PermissionId permissionId => mapping(address account => bool permitERC4337Paymaster)
    ) internal $permitERC4337Paymaster;
    mapping(PermissionId permissionId => mapping(address account => SessionValidity validity))
        internal $sessionValidity;
    /// @dev Enable-signature nonce; incrementing it invalidates signed but unused enable data.
    mapping(PermissionId permissionId => mapping(address account => uint256 nonce)) internal
        $signerNonce;
    /// @dev Namera: bumped when the module is uninstalled, invalidating the unused enable data of every session,
    /// including those never enabled (which uninstalling can't enumerate). The high 128 bits of the enable nonce.
    mapping(address account => uint256 epoch) internal $nonceEpoch;
    /// @dev Namera: whether the module was ever installed on the account (see `onInstall`).
    mapping(address account => bool) internal $installedBefore;

    /// @dev Requires the session to be enabled before and after the call, so policy initialization cannot remove
    /// it in between.
    modifier enableWithPermissionId(PermissionId permissionId) {
        $enabledSessions.requirePermissionIdEnabled(permissionId);
        _;
        $enabledSessions.requirePermissionIdEnabled(permissionId);
    }

    /// @dev Requires the session to be enabled before the call.
    modifier disableWithPermissionId(PermissionId permissionId) {
        $enabledSessions.requirePermissionIdEnabled(permissionId);
        _;
    }

    // ---------------------------------------------------------------------------------------------
    // Session management
    // ---------------------------------------------------------------------------------------------

    /// @inheritdoc ISmartSession
    function enableSessions(Session[] calldata sessions)
        external
        returns (PermissionId[] memory permissionIds)
    {
        return _enableSessions(sessions);
    }

    /// @inheritdoc ISmartSession
    function enableUserOpPolicies(PermissionId permissionId, PolicyData[] memory userOpPolicies)
        external
        enableWithPermissionId(permissionId)
    {
        // Namera: an unused enable signature must not restore what the owner changes (spent before any policy call).
        _revokeEnableSignature(permissionId);
        $userOpPolicies.enable({
            policyType: PolicyType.USER_OP,
            permissionId: permissionId,
            configId: permissionId.toUserOpPolicyId().toConfigId(),
            policyDatas: userOpPolicies
        });
    }

    /// @inheritdoc ISmartSession
    function disableUserOpPolicies(PermissionId permissionId, address[] calldata policies)
        external
        disableWithPermissionId(permissionId)
    {
        // Namera: an unused enable signature must not restore what the owner changes (spent before any policy call).
        _revokeEnableSignature(permissionId);
        $userOpPolicies.disable({
            policyType: PolicyType.USER_OP,
            account: msg.sender,
            permissionId: permissionId,
            policies: policies
        });
    }

    /// @inheritdoc ISmartSession
    function enableERC1271Policies(PermissionId permissionId, ERC7739Data calldata erc1271Policies)
        external
        enableWithPermissionId(permissionId)
    {
        // Namera: an unused enable signature must not restore what the owner changes (spent before any policy call).
        _revokeEnableSignature(permissionId);
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

    /// @inheritdoc ISmartSession
    function disableERC1271Policies(
        PermissionId permissionId,
        address[] calldata policies,
        ERC7739Context[] calldata contexts
    ) external disableWithPermissionId(permissionId) {
        // Namera: an unused enable signature must not restore what the owner changes (spent before any policy call).
        _revokeEnableSignature(permissionId);
        $enabledERC7739.disable(contexts, permissionId, msg.sender);
        $erc1271Policies.disable({
            policyType: PolicyType.ERC1271,
            account: msg.sender,
            permissionId: permissionId,
            policies: policies
        });
    }

    /// @inheritdoc ISmartSession
    function enableActionPolicies(PermissionId permissionId, ActionData[] memory actionPolicies)
        external
        enableWithPermissionId(permissionId)
    {
        // Namera: an unused enable signature must not restore what the owner changes (spent before any policy call).
        _revokeEnableSignature(permissionId);
        $actionPolicies.enable({permissionId: permissionId, actionPolicyDatas: actionPolicies});
    }

    /// @inheritdoc ISmartSession
    function disableActionId(PermissionId permissionId, ActionId actionId)
        external
        disableWithPermissionId(permissionId)
    {
        // Namera: an unused enable signature must not restore what the owner changes (spent before any policy call).
        _revokeEnableSignature(permissionId);
        $actionPolicies.actionPolicies[actionId].policyList[permissionId].removeAll(msg.sender);
        // slither-disable-next-line unused-return
        $actionPolicies.enabledActionIds[permissionId].remove(msg.sender, ActionId.unwrap(actionId));
        emit ActionIdDisabled(permissionId, actionId, msg.sender);
    }

    /// @inheritdoc ISmartSession
    function disableActionPolicies(
        PermissionId permissionId,
        ActionId actionId,
        address[] calldata policies
    ) external disableWithPermissionId(permissionId) {
        // Namera: an unused enable signature must not restore what the owner changes (spent before any policy call).
        _revokeEnableSignature(permissionId);
        EnumerableSet.AddressSet storage $policies =
            $actionPolicies.actionPolicies[actionId].policyList[permissionId];
        $actionPolicies.actionPolicies[actionId].disable({
            policyType: PolicyType.ACTION,
            account: msg.sender,
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

    /// @notice Sets whether user operations of an enabled session may use a paymaster.
    function setPermit4337Paymaster(PermissionId permissionId, bool enabled) external {
        // Namera: an unused enable signature must not restore what the owner changes (spent before any policy call).
        _revokeEnableSignature(permissionId);
        $enabledSessions.requirePermissionIdEnabled(permissionId);
        _setPermit4337Paymaster(permissionId, enabled);
    }

    /// @inheritdoc ISmartSession
    function revokeEnableSignature(PermissionId permissionId) external {
        _revokeEnableSignature(permissionId);
    }

    // ---------------------------------------------------------------------------------------------
    // Module lifecycle
    // ---------------------------------------------------------------------------------------------

    /// @inheritdoc ISmartSession
    function onInstall(bytes calldata data) external override {
        // Namera: only Kernel 3.3, the account these modules are built and tested for (`SupportedAccount`).
        SupportedAccount.check(msg.sender);
        // Sessions left over from an earlier installation must be removed explicitly first; reinstalling must not
        // silently reactivate them.
        if ($enabledSessions.length(msg.sender) != 0) {
            revert SmartSessionModuleAlreadyInstalled(msg.sender);
        }
        // Namera: Kernel ignores a failed `onUninstall`, whose revert also undoes its epoch bump, so a reinstall spends
        // every enable signature of the earlier installation. A first install keeps epoch 0, so enable signatures made
        // before the account was deployed stay valid.
        if ($installedBefore[msg.sender]) ++$nonceEpoch[msg.sender];
        else $installedBefore[msg.sender] = true;
        if (data.length == 0) return;

        SmartSessionMode mode = SmartSessionMode(uint8(bytes1(data[:1])));
        if (!mode.isEnableMode()) revert InvalidMode();
        data = data[1:];

        // `abi.decode(data, (Session[]))` without copying to memory.
        Session[] calldata sessions;
        assembly ("memory-safe") {
            let dataPointer := add(data.offset, calldataload(data.offset))
            sessions.offset := add(dataPointer, 32)
            sessions.length := calldataload(dataPointer)
        }
        _enableSessions(sessions);
    }

    /// @inheritdoc ISmartSession
    function onUninstall(bytes calldata) external override {
        uint256 count = $enabledSessions.length(msg.sender);
        for (uint256 i; i < count; ++i) {
            // `removeSession` shifts the set, so always remove the first entry.
            removeSession(PermissionId.wrap($enabledSessions.valueAt(msg.sender, 0)));
        }
        // Namera: sessions never enabled keep unused enable signatures; a new epoch invalidates them all.
        ++$nonceEpoch[msg.sender];
    }

    /// @inheritdoc ISmartSession
    function isInitialized(address account) external view override returns (bool) {
        return $enabledSessions.length(account) != 0;
    }

    /// @inheritdoc ISmartSession
    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == ERC7579_MODULE_TYPE_VALIDATOR;
    }

    // ---------------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------------

    /// @inheritdoc ISmartSession
    function getSessionDigest(
        PermissionId permissionId,
        address account,
        Session memory session,
        SmartSessionMode mode
    ) external view returns (bytes32) {
        return session.sessionDigest({
            account: account, mode: mode, nonce: _nonce(permissionId, account)
        });
    }

    /// @inheritdoc ISmartSession
    function getPermissionId(Session calldata session) external pure returns (PermissionId) {
        return session.toPermissionId();
    }

    /// @inheritdoc ISmartSession
    function getNonce(PermissionId permissionId, address account) external view returns (uint256) {
        return _nonce(permissionId, account);
    }

    /// @inheritdoc ISmartSession
    function getSessionValidity(PermissionId permissionId, address account)
        external
        view
        returns (uint48 validAfter, uint48 validUntil)
    {
        SessionValidity memory validity = $sessionValidity[permissionId][account];
        return (validity.validAfter, validity.validUntil);
    }

    /// @inheritdoc ISmartSession
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

    /// @inheritdoc ISmartSession
    function isPermissionEnabled(PermissionId permissionId, address account)
        external
        view
        returns (bool)
    {
        return $enabledSessions.contains(account, PermissionId.unwrap(permissionId));
    }

    /// @notice Whether `account`'s session `permissionId` has a session validator.
    function isISessionValidatorSet(PermissionId permissionId, address account)
        external
        view
        returns (bool)
    {
        return _isISessionValidatorSet(permissionId, account);
    }

    /// @notice The session validator of `account`'s session `permissionId` and its configuration.
    function getSessionValidatorAndConfig(address account, PermissionId permissionId)
        external
        view
        returns (address sessionValidator, bytes memory sessionValidatorData)
    {
        SignerConf storage $conf = $sessionValidators[permissionId][account];
        sessionValidator = address($conf.sessionValidator);
        sessionValidatorData = $conf.config.load();
    }

    /// @notice Whether every policy of `userOpPolicies` is a user operation policy of the session.
    /// @dev Takes full `PolicyData` (not addresses) so a `Session` can be checked directly.
    function areUserOpPoliciesEnabled(
        address account,
        PermissionId permissionId,
        PolicyData[] calldata userOpPolicies
    ) external view returns (bool) {
        return $userOpPolicies.areEnabled({
            permissionId: permissionId, account: account, policyDatas: userOpPolicies
        });
    }

    /// @notice Whether every policy of `erc1271Policies` is an ERC-1271 policy of the session.
    function areERC1271PoliciesEnabled(
        address account,
        PermissionId permissionId,
        PolicyData[] calldata erc1271Policies
    ) external view returns (bool) {
        return $erc1271Policies.areEnabled({
            permissionId: permissionId, account: account, policyDatas: erc1271Policies
        });
    }

    /// @notice Whether every policy of every action of `actions` is enabled for the session.
    function areActionsEnabled(
        address account,
        PermissionId permissionId,
        ActionData[] calldata actions
    ) external view returns (bool) {
        return $actionPolicies.areEnabled({
            permissionId: permissionId, account: account, actionPolicyDatas: actions
        });
    }

    /// @notice Whether `policy` is a user operation policy of the session.
    function isUserOpPolicyEnabled(address account, PermissionId permissionId, address policy)
        external
        view
        returns (bool)
    {
        return $userOpPolicies.policyList[permissionId].contains(account, policy);
    }

    /// @notice Whether `policy` is an ERC-1271 policy of the session.
    function isERC1271PolicyEnabled(address account, PermissionId permissionId, address policy)
        external
        view
        returns (bool)
    {
        return $erc1271Policies.policyList[permissionId].contains(account, policy);
    }

    /// @notice Whether `policy` is a policy of the session's action `actionId`.
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

    /// @notice Whether the session has action `actionId`.
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

    /// @notice Whether the session key may sign ERC-7739 content `content` for the app domain `appDomainSeparator`.
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

    /// @notice The session's user operation policies.
    function getUserOpPolicies(address account, PermissionId permissionId)
        external
        view
        returns (address[] memory)
    {
        return $userOpPolicies.policyList[permissionId].values(account);
    }

    /// @notice The session's ERC-1271 policies.
    function getERC1271Policies(address account, PermissionId permissionId)
        external
        view
        returns (address[] memory)
    {
        return $erc1271Policies.policyList[permissionId].values(account);
    }

    /// @notice The policies of the session's action `actionId`.
    function getActionPolicies(address account, PermissionId permissionId, ActionId actionId)
        external
        view
        returns (address[] memory)
    {
        return $actionPolicies.actionPolicies[actionId].policyList[permissionId].values(account);
    }

    /// @notice The session's action ids.
    function getEnabledActions(address account, PermissionId permissionId)
        external
        view
        returns (bytes32[] memory)
    {
        return $actionPolicies.enabledActionIds[permissionId].values(account);
    }

    /// @notice The session's ERC-7739 app domains, each with the hashes of its allowed content names.
    function getEnabledERC7739Content(address account, PermissionId permissionId)
        external
        view
        returns (ERC7739ContextHashes[] memory contents)
    {
        bytes32[] memory domainSeparators =
            $enabledERC7739.enabledDomainSeparators[permissionId].values(account);
        uint256 length = domainSeparators.length;
        contents = new ERC7739ContextHashes[](length);
        for (uint256 i; i < length; ++i) {
            bytes32 domainSeparator = domainSeparators[i];
            contents[i].appDomainSeparator = domainSeparator;
            contents[i].contentNameHashes =
                $enabledERC7739.enabledContentNames[permissionId][domainSeparator].values(account);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Session removal
    // ---------------------------------------------------------------------------------------------

    /// @inheritdoc ISmartSession
    /// @dev Policy state is not wiped: re-enabling a policy re-initializes it (`initializeWithMultiplexer`).
    function removeSession(PermissionId permissionId) public {
        if (permissionId == EMPTY_PERMISSIONID) revert InvalidSession(permissionId);

        $userOpPolicies.policyList[permissionId].removeAll(msg.sender);
        $erc1271Policies.policyList[permissionId].removeAll(msg.sender);

        EnumerableSet.Bytes32Set storage $actionIds = $actionPolicies.enabledActionIds[permissionId];
        bytes32[] memory actionIds = $actionIds.values(msg.sender);
        uint256 length = actionIds.length;
        for (uint256 i; i < length; ++i) {
            $actionPolicies.actionPolicies[ActionId.wrap(
                    actionIds[i]
                )].policyList[permissionId].removeAll(msg.sender);
        }
        $actionIds.removeAll(msg.sender);

        $sessionValidators.disable({permissionId: permissionId, account: msg.sender});
        delete $permitERC4337Paymaster[permissionId][msg.sender];
        delete $sessionValidity[permissionId][msg.sender];

        // slither-disable-next-line unused-return
        $enabledSessions.remove({account: msg.sender, value: PermissionId.unwrap(permissionId)});
        $enabledERC7739.removeAll({permissionId: permissionId, account: msg.sender});
        // Otherwise an unused ENABLE signature for this session could enable it again.
        _revokeEnableSignature(permissionId);
        emit SessionRemoved(permissionId, msg.sender);
    }

    // ---------------------------------------------------------------------------------------------
    // Internal functions
    // ---------------------------------------------------------------------------------------------

    /// @dev Enables each of `sessions` for the calling account, spending its enable nonce first.
    // Policies run with `msg.sender` = policy, so reentrancy from them cannot change this account's state.
    // slither-disable-next-line reentrancy-benign,reentrancy-events,reentrancy-no-eth
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
            // Policies called in earlier iterations run with `msg.sender` = policy, so a reentrant call cannot
            // change this account's state.
            // forge-lint: disable-next-line(reentrancy-events)
            emit SessionCreated(permissionId, msg.sender);
            // Namera: an unused enable signature must not restore an older configuration of this session.
            _revokeEnableSignature(permissionId);
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

    /// @dev Spends the enable nonce of the calling account's session `permissionId`.
    function _revokeEnableSignature(PermissionId permissionId) internal {
        uint256 nonce = $signerNonce[permissionId][msg.sender]++;
        // In `_enableSessions`, policies called in earlier iterations run with `msg.sender` = policy, so a reentrant call
        // cannot change this account's state.
        // forge-lint: disable-next-line(reentrancy-events)
        emit NonceIterated(permissionId, msg.sender, nonce + 1);
    }

    function _setPermit4337Paymaster(PermissionId permissionId, bool enabled) internal {
        $permitERC4337Paymaster[permissionId][msg.sender] = enabled;
        // Policies called in earlier iterations run with `msg.sender` = policy, so a reentrant call cannot
        // change this account's state.
        // forge-lint: disable-next-line(reentrancy-events)
        emit PermissionIdPermit4337Paymaster(permissionId, msg.sender, enabled);
    }

    /// @dev Stores the session's validity window; `validAfter` must be before a nonzero `validUntil`.
    function _setSessionValidity(PermissionId permissionId, uint48 validAfter, uint48 validUntil)
        internal
    {
        if (validUntil != 0 && validAfter >= validUntil) {
            revert InvalidSessionValidity(validAfter, validUntil);
        }
        $sessionValidity[permissionId][msg.sender] =
            SessionValidity({validAfter: validAfter, validUntil: validUntil});
        // Policies called in earlier iterations run with `msg.sender` = policy, so a reentrant call cannot
        // change this account's state.
        // forge-lint: disable-next-line(reentrancy-events)
        emit SessionValiditySet(permissionId, msg.sender, validAfter, validUntil);
    }

    /// @dev The enable nonce the owner signs: the account's epoch ‖ the session's counter (128 bits each).
    function _nonce(PermissionId permissionId, address account) internal view returns (uint256) {
        return ($nonceEpoch[account] << 128) | $signerNonce[permissionId][account];
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
}
