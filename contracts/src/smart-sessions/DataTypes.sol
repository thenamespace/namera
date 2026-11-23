// SPDX-License-Identifier: AGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import {ISessionValidator} from "./interfaces/ISessionValidator.sol";
import {FlatBytesLib} from "./lib/FlatBytesLib.sol";
import {EnumerableSet} from "./utils/EnumerableSet4337.sol";

// ---------------------------------------------------------------------------------------------------------------------
// Session parameters
// ---------------------------------------------------------------------------------------------------------------------

/// @notice A session to enable inside a user operation (ENABLE / UNSAFE_ENABLE modes).
/// @param chainDigestIndex Index of this chain's entry in `hashesAndChainIds`.
/// @param hashesAndChainIds Session digest per chain; the owner signs all of them at once.
/// @param sessionToEnable The session for this chain.
/// @param permissionEnableSig The account's ERC-1271 signature over the multichain digest.
struct EnableSession {
    uint8 chainDigestIndex;
    ChainDigest[] hashesAndChainIds;
    Session sessionToEnable;
    bytes permissionEnableSig;
}

struct ChainDigest {
    uint64 chainId;
    bytes32 sessionDigest;
}

/// @notice A session key permission.
/// @param sessionValidator Stateless validator (ERC-7579 type 7) that checks the session key's signatures.
/// @param sessionValidatorInitData Validator config, e.g. the session key's signers and threshold.
/// @param salt Distinguishes otherwise identical sessions.
/// @param userOpPolicies Policies run on every user operation.
/// @param erc7739Policies ERC-7739 contents and ERC-1271 policies for session-key signatures.
/// @param actions Per target-and-selector policies for executions.
/// @param permitERC4337Paymaster Whether user operations of this session may use a paymaster.
/// @param validAfter Session start; valid when `validAfter <= block.timestamp` (0 = no start bound).
/// @param validUntil Session end; valid when `block.timestamp <= validUntil` (0 = no expiry).
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

/// @notice A policy contract and its per-session initialization data.
struct PolicyData {
    address policy;
    bytes initData;
}

/// @notice Policies that apply to calls of `actionTargetSelector` on `actionTarget`.
struct ActionData {
    bytes4 actionTargetSelector;
    address actionTarget;
    PolicyData[] actionPolicies;
}

/// @notice What a session key's ERC-1271 signature asks the ERC-1271 policies to accept (Namera).
/// @dev `hash` is the final nested hash the session key signed. Smart Sessions has bound `appDomainSeparator` to
/// the requested hash and, when not empty, `contentsData` to the signed struct hash; `policyData` is unchecked.
struct ERC1271Request {
    address requestSender;
    bytes32 hash;
    bytes32 appDomainSeparator;
    bytes contentsData;
    bytes policyData;
}

/// @notice ERC-7739 contents a session key may sign for one app domain.
/// Only the domain separator is stored, as EIP-712 lets apps omit unused domain fields.
/// Content names are advisory: `contents` is an opaque struct hash, so a session key can sign any struct of the
/// app under an allowed name. They keep honest signers from being phished into other types; the enforced bounds
/// are the app domain and the ERC-1271 policies.
struct ERC7739Context {
    bytes32 appDomainSeparator;
    string[] contentNames;
}

struct ERC7739Data {
    ERC7739Context[] allowedERC7739Content;
    PolicyData[] erc1271Policies;
}

/// @notice How `userOp.signature` is interpreted.
/// USE: an enabled session; ENABLE / UNSAFE_ENABLE: enable a session first, then use it.
enum SmartSessionMode {
    USE,
    ENABLE,
    UNSAFE_ENABLE
}

struct ERC7739ContextHashes {
    bytes32 appDomainSeparator;
    bytes32[] contentNameHashes;
}

// ---------------------------------------------------------------------------------------------------------------------
// Storage (account-associated, so validation-time reads satisfy ERC-7562)
// ---------------------------------------------------------------------------------------------------------------------

struct SessionValidity {
    uint48 validAfter;
    uint48 validUntil;
}

struct SignerConf {
    ISessionValidator sessionValidator;
    FlatBytesLib.Bytes config;
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

// ---------------------------------------------------------------------------------------------------------------------
// Types and constants
// ---------------------------------------------------------------------------------------------------------------------

type PermissionId is bytes32;

type ActionId is bytes32;

type ActionPolicyId is bytes32;

type UserOpPolicyId is bytes32;

type Erc1271PolicyId is bytes32;

type ConfigId is bytes32;

/// @dev ERC-4337 validation data: `aggregator | validUntil << 160 | validAfter << 208`.
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
/// @dev Namera: the last word of an operation tagged for `SessionHook` (`… ‖ permissionId ‖ SESSION_HOOK_TAG`).
bytes32 constant SESSION_HOOK_TAG = keccak256("namera.session-hook.tag");

enum PolicyType {
    NA,
    USER_OP,
    ACTION,
    ERC1271
}

/// @dev Action target that marks a fallback action. With `FALLBACK_TARGET_SELECTOR_FLAG` its policies apply to
/// every action without its own policies, except calls on the account itself; with `FALLBACK_TARGET_SELECTOR_FLAG_PERMITTED_TO_CALL_SMARTSESSION`
/// they apply to calls into this module.
address constant FALLBACK_TARGET_FLAG = address(1);
bytes4 constant FALLBACK_TARGET_SELECTOR_FLAG = 0x00000001;
bytes4 constant FALLBACK_TARGET_SELECTOR_FLAG_PERMITTED_TO_CALL_SMARTSESSION = 0x00000002;
/// @dev keccak256(abi.encodePacked(FALLBACK_TARGET_FLAG, FALLBACK_TARGET_SELECTOR_FLAG))
ActionId constant FALLBACK_ACTIONID =
    ActionId.wrap(0xd884b6afa19f8ace90a388daca691e4e28f20cdac5aeefd46ad8bd1c074d28cf);
/// @dev keccak256(abi.encodePacked(FALLBACK_TARGET_FLAG, FALLBACK_TARGET_SELECTOR_FLAG_PERMITTED_TO_CALL_SMARTSESSION))
ActionId constant FALLBACK_ACTIONID_SMARTSESSION_CALL =
    ActionId.wrap(0x986126569d6396d837d7adeb3ca726199afaf83546f38726e6f331bb92d8e9d6);

/// @dev Sentinel returned by `PolicyLib.tryCheck` when an action has too few policies, so the caller falls back
/// to `FALLBACK_ACTIONID`. Policies may not return it.
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
