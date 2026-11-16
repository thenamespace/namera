// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.38;

import {ISessionValidator} from "./interfaces/ISessionValidator.sol";
import {FlatBytesLib} from "./lib/FlatBytesLib.sol";
import {EnumerableSet} from "./utils/EnumerableSet4337.sol";

/*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
/*                       Parameters                           */
/*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

struct EnableSession {
    uint8 chainDigestIndex;
    ChainDigest[] hashesAndChainIds;
    Session sessionToEnable;
    // in order to enable a session, the smart account has to sign a digest. The signature for this is stored here.
    bytes permissionEnableSig;
}

struct ChainDigest {
    uint64 chainId;
    bytes32 sessionDigest;
}

/**
 * Represents a Session structure with various attributes for managing user operations and policies.
 *
 * Attributes:
 *     sessionValidator (ISessionValidator): The validator contract for signing user operations.
 *         Every userOp must be signed by the session key "owner". The signature is validated
 *         via a stateless external contract (ISessionValidator) that can implement different
 *         means of validation.
 *
 *     sessionValidatorInitData (bytes): Initialization data for the ISessionValidator contract.
 *
 *     salt (bytes32): A unique identifier to prevent collision between sessions.
 *
 *     userOpPolicies (PolicyData[]): An array of policy data for user operations.
 *
 *     erc7739Policies (ERC7739Data): ERC1271 Policies specific to the ERC7739 standard.
 *
 *     actions (ActionData[]): An array of action data for specifying function-specific policies.
 *         A common use case of session keys is to scope access to a specific target and function
 *         selector. SmartSession calls this "Action". With ActionData, we can specify policies
 *         that are only run if a 7579 execution contains a specific action.
 *
 *     validAfter / validUntil (uint48): Namera addition. The session is valid when
 *         validAfter < block.timestamp <= validUntil (ERC-4337 semantics; 0 means no bound). Enforced for
 *         user operations through validation data and for ERC-1271 signatures directly.
 */
struct Session {
    ISessionValidator sessionValidator;
    bytes sessionValidatorInitData;
    bytes32 salt;
    PolicyData[] userOpPolicies;
    ERC7739Data erc7739Policies;
    ActionData[] actions;
    bool permitERC4337Paymaster;
    uint48 validAfter;
    uint48 validUntil;
}

// Policy data is a struct that contains the policy address and the initialization data for the policy.
struct PolicyData {
    address policy;
    bytes initData;
}

// Action data is a struct that contains the actionId and the policies that are associated with this action.
struct ActionData {
    bytes4 actionTargetSelector;
    address actionTarget;
    PolicyData[] actionPolicies;
}

struct ERC7739Context {
    // we can not use a detailed EIP712Domain struct here.
    // EIP712 specifies: Protocol designers only need to include the fields that make sense for their signing domain.
    // Unused fields are left out of the struct type.
    bytes32 appDomainSeparator;
    string[] contentNames;
}

struct ERC7739Data {
    ERC7739Context[] allowedERC7739Content;
    PolicyData[] erc1271Policies;
}

enum SmartSessionMode {
    USE,
    ENABLE,
    UNSAFE_ENABLE
}

struct ERC7739ContextHashes {
    bytes32 appDomainSeparator;
    bytes32[] contentNameHashes;
}

/*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
/*                         Storage                            */
/*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

struct SessionValidity {
    uint48 validAfter;
    uint48 validUntil;
}

struct SignerConf {
    ISessionValidator sessionValidator;
    FlatBytesLib.Bytes config; // using FlatBytes to get around storage slot limitations
}

struct Policy {
    mapping(PermissionId => EnumerableSet.AddressSet) policyList;
}

struct EnumerableActionPolicy {
    mapping(ActionId => Policy) actionPolicies;
    mapping(PermissionId => EnumerableSet.Bytes32Set) enabledActionIds;
}

struct EnumerableERC7739Config {
    mapping(PermissionId => mapping(bytes32 appDomainSeparator => EnumerableSet.Bytes32Set))
        enabledContentNames;
    mapping(PermissionId => EnumerableSet.Bytes32Set) enabledDomainSeparators;
}

/*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
/*                 Custom Types & Constants                   */
/*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

type PermissionId is bytes32;

type ActionId is bytes32;

type ActionPolicyId is bytes32;

type UserOpPolicyId is bytes32;

type Erc1271PolicyId is bytes32;

type ConfigId is bytes32;

type ValidationData is uint256;

ActionId constant EMPTY_ACTIONID = ActionId.wrap(bytes32(0));
PermissionId constant EMPTY_PERMISSIONID = PermissionId.wrap(bytes32(0));

ValidationData constant ERC4337_VALIDATION_FAILED = ValidationData.wrap(1);
bytes4 constant EIP1271_FAILED = 0xFFFFFFFF;

uint256 constant ERC7579_MODULE_TYPE_VALIDATOR = 1;
uint256 constant ERC7579_MODULE_TYPE_STATELESS_VALIDATOR = 7;

/// @dev Selector of ERC-7579 `execute(bytes32,bytes)`.
bytes4 constant ERC7579_EXECUTE_SELECTOR = 0xe9ae5c53;
/// @dev Selector of ERC-4337 `executeUserOp(PackedUserOperation,bytes32)`.
bytes4 constant ERC4337_EXECUTE_USER_OP_SELECTOR = 0x8dd7712f;

enum PolicyType {
    NA,
    USER_OP,
    ACTION,
    ERC1271
}

// ActionId for a fallback action policy. This id will be used if both action
// target and selector are set to 1. During validation if the current target and
// selector does not have a set action policy, then the fallback will be used if
// enabled.
address constant FALLBACK_TARGET_FLAG = address(1);
bytes4 constant FALLBACK_TARGET_SELECTOR_FLAG = 0x00000001;
bytes4 constant FALLBACK_TARGET_SELECTOR_FLAG_PERMITTED_TO_CALL_SMARTSESSION = 0x00000002;
// keccak256(abi.encodePacked(FALLBACK_TARGET_FLAG, FALLBACK_TARGET_SELECTOR_FLAG))
ActionId constant FALLBACK_ACTIONID =
    ActionId.wrap(0xd884b6afa19f8ace90a388daca691e4e28f20cdac5aeefd46ad8bd1c074d28cf);

// keccak256(abi.encodePacked(FALLBACK_TARGET_FLAG, FALLBACK_TARGET_SELECTOR_FLAG_PERMITTED_TO_CALL_SMARTSESSION))
ActionId constant FALLBACK_ACTIONID_SMARTSESSION_CALL =
    ActionId.wrap(0x986126569d6396d837d7adeb3ca726199afaf83546f38726e6f331bb92d8e9d6);

// A unique ValidationData value to retry a policy check with the FALLBACK_ACTIONID.
ValidationData constant RETRY_WITH_FALLBACK = ValidationData.wrap(uint256(0x50FFBAAD));

using {isUseMode, isEnableMode} for SmartSessionMode global;

function isUseMode(SmartSessionMode mode) pure returns (bool) {
    return mode == SmartSessionMode.USE;
}

function isEnableMode(SmartSessionMode mode) pure returns (bool) {
    return mode == SmartSessionMode.ENABLE || mode == SmartSessionMode.UNSAFE_ENABLE;
}

using {validationDataEq as ==} for ValidationData global;

function validationDataEq(ValidationData a, ValidationData b) pure returns (bool) {
    return ValidationData.unwrap(a) == ValidationData.unwrap(b);
}

using {permissionIdEq as ==} for PermissionId global;

function permissionIdEq(PermissionId a, PermissionId b) pure returns (bool) {
    return PermissionId.unwrap(a) == PermissionId.unwrap(b);
}

using {actionIdEq as ==} for ActionId global;

function actionIdEq(ActionId a, ActionId b) pure returns (bool) {
    return ActionId.unwrap(a) == ActionId.unwrap(b);
}
