// SPDX-License-Identifier: AGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import "./DataTypes.sol";
import {ERC4337} from "solady/accounts/ERC4337.sol";

/// @title ISmartSession
/// @notice ERC-7579 validator module for session keys. A session (identified by its `PermissionId`) pairs a
/// session validator, which checks the session key's signature, with policies that bound what the key may do:
/// user-operation policies, per-action policies and ERC-1271 policies. Sessions can be enabled by the account
/// directly or inside the first user operation that uses them, with an owner signature (ENABLE mode).
interface ISmartSession {
    error AssociatedArray_OutOfBounds(uint256 index);
    error ChainIdMismatch(uint64 providedChainId);
    error HashMismatch(bytes32 providedHash, bytes32 computedHash);
    error InvalidData();
    error InvalidActionId();
    error NoExecutionsInBatch();
    error InvalidTarget();
    error InvalidEnableSignature(address account, bytes32 hash);
    error InvalidISessionValidator(ISessionValidator sessionValidator);
    error InvalidSelfCall();
    error InvalidSession(PermissionId permissionId);
    error SmartSessionModuleAlreadyInstalled(address account);
    error InvalidPermissionId(PermissionId permissionId);
    error InvalidMode();
    error InvalidUserOpSender(address sender);
    /// @dev Namera: the operation is tagged for SessionHook with another session's permission id.
    error InvalidSessionHookTag(PermissionId permissionId);
    error NoPoliciesSet(PermissionId permissionId);
    error PolicyViolation(PermissionId permissionId, address policy);
    error SignerNotFound(PermissionId permissionId, address account);
    error UnsupportedCallType(bytes1 callType);
    error UnsupportedExecutionType();
    error UnsupportedPolicy(address policy);
    error UnsupportedSmartSessionMode(SmartSessionMode mode);
    error ForbiddenValidationData();
    error PaymasterValidationNotEnabled(PermissionId permissionId);
    error InvalidSessionValidity(uint48 validAfter, uint48 validUntil);

    event NonceIterated(PermissionId permissionId, address account, uint256 newValue);
    event SessionValidatorEnabled(
        PermissionId permissionId, address sessionValidator, address smartAccount
    );
    event SessionValidatorDisabled(
        PermissionId permissionId, address sessionValidator, address smartAccount
    );
    event PolicyDisabled(
        PermissionId permissionId, PolicyType policyType, address policy, address smartAccount
    );
    event ActionIdDisabled(PermissionId permissionId, ActionId actionId, address smartAccount);
    event PolicyEnabled(
        PermissionId permissionId, PolicyType policyType, address policy, address smartAccount
    );
    event SessionCreated(PermissionId permissionId, address account);
    event SessionRemoved(PermissionId permissionId, address smartAccount);
    event SessionValiditySet(
        PermissionId permissionId, address smartAccount, uint48 validAfter, uint48 validUntil
    );
    event PermissionIdPermit4337Paymaster(
        PermissionId permissionId, address smartAccount, bool enabled
    );

    // -----------------------------------------------------------------------------------------------------------------
    // ERC-7579 validator
    // -----------------------------------------------------------------------------------------------------------------

    /// @notice Validates a user operation of the calling account against a session.
    /// @dev `userOp.signature` is `mode ‖ data`. In USE mode `data` is `permissionId ‖ sessionKeySignature`; in the
    /// enable modes it is the FastLZ-compressed `abi.encode(EnableSession, sessionKeySignature)`.
    function validateUserOp(ERC4337.PackedUserOperation memory userOp, bytes32 userOpHash)
        external
        returns (ValidationData vd);

    /// @notice Installs the module. `data` is empty or `abi.encodePacked(enableMode, abi.encode(Session[]))`.
    function onInstall(bytes memory data) external;

    /// @notice Removes every session of the calling account.
    function onUninstall(bytes memory) external;

    /// @notice ERC-7579 ERC-1271 forwarding: validates a session-key signature wrapped in ERC-7739.
    function isValidSignatureWithSender(address sender, bytes32 hash, bytes memory signature)
        external
        view
        returns (bytes4 result);

    function isInitialized(address smartAccount) external view returns (bool);

    function isModuleType(uint256 typeID) external pure returns (bool);

    // -----------------------------------------------------------------------------------------------------------------
    // Session management (called by the account)
    // -----------------------------------------------------------------------------------------------------------------

    function enableActionPolicies(PermissionId permissionId, ActionData[] memory actionPolicies)
        external;

    function enableERC1271Policies(PermissionId permissionId, ERC7739Data calldata erc1271Policies)
        external;

    function enableSessions(Session[] memory sessions)
        external
        returns (PermissionId[] memory permissionIds);

    function enableUserOpPolicies(PermissionId permissionId, PolicyData[] memory userOpPolicies)
        external;

    function disableActionPolicies(
        PermissionId permissionId,
        ActionId actionId,
        address[] memory policies
    ) external;

    function disableActionId(PermissionId permissionId, ActionId actionId) external;

    function disableERC1271Policies(
        PermissionId permissionId,
        address[] memory policies,
        ERC7739Context[] calldata contexts
    ) external;

    function disableUserOpPolicies(PermissionId permissionId, address[] memory policies) external;

    function removeSession(PermissionId permissionId) external;

    /// @notice Invalidates enable signatures that have not been used yet.
    function revokeEnableSignature(PermissionId permissionId) external;

    // -----------------------------------------------------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------------------------------------------------

    /// @notice The digest the owner signs (per chain) to enable `data` for `account`.
    function getSessionDigest(
        PermissionId permissionId,
        address account,
        Session memory data,
        SmartSessionMode mode
    ) external view returns (bytes32);

    function getNonce(PermissionId permissionId, address account) external view returns (uint256);

    function getPermissionId(Session memory session)
        external
        pure
        returns (PermissionId permissionId);

    function isPermissionEnabled(PermissionId permissionId, address account)
        external
        view
        returns (bool);

    function getSessionValidity(PermissionId permissionId, address account)
        external
        view
        returns (uint48 validAfter, uint48 validUntil);

    function getPermissionIDs(address account)
        external
        view
        returns (PermissionId[] memory permissionIds);
}
