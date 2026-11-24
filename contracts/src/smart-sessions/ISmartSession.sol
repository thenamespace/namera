// SPDX-License-Identifier: AGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {
    ActionData,
    ActionId,
    ERC7739Context,
    ERC7739Data,
    PermissionId,
    PolicyData,
    PolicyType,
    Session,
    SmartSessionMode,
    ValidationData
} from "./DataTypes.sol";
import {ISessionValidator} from "./interfaces/ISessionValidator.sol";

/// @notice ERC-7579 validator module for session keys. A session (identified by its `PermissionId`) pairs a
/// session validator, which checks the session key's signature, with policies that bound what the key may do:
/// user-operation policies, per-action policies and ERC-1271 policies. Sessions can be enabled by the account
/// directly or inside the first user operation that uses them, with an owner signature (ENABLE mode).
interface ISmartSession {
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

    /// @notice Whether `account` has any session enabled.
    function isInitialized(address account) external view returns (bool);

    /// @notice Whether the module is of ERC-7579 module type `moduleTypeId` (only validators, type 1).
    function isModuleType(uint256 moduleTypeId) external pure returns (bool);

    /// @notice Adds or reconfigures action policies of an enabled session.
    function enableActionPolicies(PermissionId permissionId, ActionData[] memory actionPolicies)
        external;

    /// @notice Adds ERC-7739 contents and ERC-1271 policies to an enabled session.
    function enableERC1271Policies(PermissionId permissionId, ERC7739Data calldata erc1271Policies)
        external;

    /// @notice Enables sessions for the calling account and returns their permission IDs.
    function enableSessions(Session[] memory sessions)
        external
        returns (PermissionId[] memory permissionIds);

    /// @notice Adds or reconfigures user operation policies of an enabled session.
    function enableUserOpPolicies(PermissionId permissionId, PolicyData[] memory userOpPolicies)
        external;

    /// @notice Disables some policies of an action; the action is disabled when none remain.
    function disableActionPolicies(
        PermissionId permissionId,
        ActionId actionId,
        address[] memory policies
    ) external;

    /// @notice Disables an action and all of its policies.
    function disableActionId(PermissionId permissionId, ActionId actionId) external;

    /// @notice Disables ERC-7739 contents and ERC-1271 policies of an enabled session.
    function disableERC1271Policies(
        PermissionId permissionId,
        address[] memory policies,
        ERC7739Context[] calldata contexts
    ) external;

    /// @notice Disables user operation policies of an enabled session.
    function disableUserOpPolicies(PermissionId permissionId, address[] memory policies) external;

    /// @notice Removes a session with its validator, policies, contents, paymaster flag and validity window, and
    /// revokes unused owner enable signatures for it on this chain.
    function removeSession(PermissionId permissionId) external;

    /// @notice Increments the enable nonce, invalidating signed but unused enable data for this permission.
    function revokeEnableSignature(PermissionId permissionId) external;

    /// @notice The digest the owner signs (per chain) to enable `session` for `account`.
    function getSessionDigest(
        PermissionId permissionId,
        address account,
        Session memory session,
        SmartSessionMode mode
    ) external view returns (bytes32);

    /// @notice The enable nonce the owner signs for `account`'s session `permissionId`.
    function getNonce(PermissionId permissionId, address account) external view returns (uint256);

    /// @notice The permission id of `session`: a hash of its validator, validator config and salt.
    function getPermissionId(Session memory session)
        external
        pure
        returns (PermissionId permissionId);

    /// @notice Whether `account` has session `permissionId` enabled.
    function isPermissionEnabled(PermissionId permissionId, address account)
        external
        view
        returns (bool);

    /// @notice The validity window of `account`'s session `permissionId` (0 for an unbounded side).
    function getSessionValidity(PermissionId permissionId, address account)
        external
        view
        returns (uint48 validAfter, uint48 validUntil);

    /// @notice The permission ids of every session `account` has enabled.
    function getPermissionIDs(address account)
        external
        view
        returns (PermissionId[] memory permissionIds);
}
