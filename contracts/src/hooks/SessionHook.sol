// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";
import {LibERC7579} from "solady/accounts/LibERC7579.sol";

import {IPolicy, IUserOpPolicy} from "../policies/interfaces/IPolicy.sol";
import {Execution, ExecutionLib} from "../smart-sessions/lib/ExecutionLib.sol";
import {SupportedAccount} from "../smart-sessions/lib/SupportedAccount.sol";
import {IExecutionPolicy} from "./interfaces/IExecutionPolicy.sol";

/// @title SessionHook
/// @notice Runs a session's execution policies around its operations on Kernel 3.3. It is two things:
/// - **a user operation policy of the session** (validation): its init data lists the session's execution policies,
///   so the owner's session signature covers them; its check requires the operation to name the session in a tag
///   appended to the calldata, to be a plain `execute`, not to call the hook, the account or the session's execution
///   policies, and the hook to be installed on the account;
/// - **the hook Kernel binds to Smart Sessions' validation** (execution): Kernel runs every Smart Sessions operation
///   through `executeUserOp` and calls the hook around it; the hook reads the tag and runs that session's execution
///   policies,
///   `preCheck` before the calls and `postCheck` after. An operation without a tag (the owner's, another validator's,
///   a session's without execution policies) passes through.
/// @dev Tag: `userOp.callData = <execute(…) | executeUserOp ‖ execute(…)> ‖ … ‖ permissionId ‖ TAG`. Every byte of
/// the calldata is in the user operation hash the session key signs and the account executes exactly those bytes, so
/// a tag can't be stripped or swapped, and an added tag only adds checks. Calldata, not state, carries the session
/// from validation to execution, so operations with identical calldata in one bundle each run their policies.
///
/// Install data `abi.encode(address smartSession)`, the Smart Sessions module whose sessions it serves (Kernel passes
/// the validation's `hookData[1:]`); only that module can set policy lists. It installs only on Kernel 3.3
/// (`SupportedAccount`).
///
/// Storage is associated with the account (ERC-7562): `account → smartSession`, `configId → account → count`,
/// `configId → index → account → policy`.
// slither-disable-next-line missing-inheritance
contract SessionHook is IUserOpPolicy {
    /// @dev One execution policy and its configuration, as a session's init data lists them.
    struct ExecutionPolicyData {
        address policy;
        bytes initData;
    }

    uint256 internal constant MODULE_TYPE_HOOK = 4;
    uint256 internal constant VALIDATION_SUCCESS = 0;
    uint256 internal constant VALIDATION_FAILED = 1;
    /// @notice The most execution policies one session may list.
    uint256 public constant MAX_EXECUTION_POLICIES = 8;

    /// @notice The last word of a tagged operation's calldata.
    bytes32 public constant TAG = keccak256("namera.session-hook.tag");
    uint256 internal constant TAIL_LENGTH = 64;

    bytes4 internal constant EXECUTE_SELECTOR = 0xe9ae5c53;
    bytes4 internal constant EXECUTE_USER_OP_SELECTOR = 0x8dd7712f;
    /// @dev Transient slot base of each account's running check: `keccak256(context)` while one runs.
    bytes32 internal constant CONTEXT_SLOT = keccak256("namera.session-hook.context");

    mapping(address account => address smartSession) internal $smartSessions;
    mapping(bytes32 configId => mapping(address account => uint256)) internal $counts;
    mapping(bytes32 configId => mapping(uint256 index => mapping(address account => address)))
        internal $policies;

    event SessionHookInstalled(address indexed account, address smartSession);
    event SessionHookUninstalled(address indexed account);
    event ExecutionPoliciesSet(
        address indexed account, bytes32 indexed configId, address[] policies
    );

    error InvalidInstall();
    error SessionHookNotInstalled(address account);
    error OnlySmartSession(address caller);
    error NotExecutionPolicy(address policy);
    error TooManyExecutionPolicies(uint256 count);
    error PermissionNotEnabled(bytes32 permissionId);
    error ReentrantCheck(address account);
    error InvalidContext(address account);
    error ExecutionPolicyViolation(bytes32 permissionId, address policy, bytes reason);

    // ---------------------------------------------------------------------------------------------
    // ERC-7579 module
    // ---------------------------------------------------------------------------------------------

    /// @notice Installs the hook on the calling Kernel 3.3 account for the sessions of one Smart Sessions module.
    /// @param data `abi.encode(address smartSession)`.
    function onInstall(bytes calldata data) external {
        _requireIdle(msg.sender);
        SupportedAccount.check(msg.sender);
        address smartSession = abi.decode(data, (address));
        if (smartSession == address(0)) revert InvalidInstall();
        // Reinstalling with the same module is allowed (Kernel rebinding runs `onInstall` again); another module needs
        // an uninstall first, so no call can quietly switch the policies off.
        address installed = $smartSessions[msg.sender];
        if (installed != address(0) && installed != smartSession) revert InvalidInstall();
        $smartSessions[msg.sender] = smartSession;
        // Only views of the account come before (`_requireIdle`, `accountId()`): nothing can re-enter.
        // forge-lint: disable-next-line(reentrancy-events)
        emit SessionHookInstalled(msg.sender, smartSession);
    }

    /// @notice Uninstalls the hook from the calling account.
    /// @dev Policy lists stay: they are reachable only through enabled sessions of the installed Smart Sessions module,
    /// and re-enabling a session sets its list again.
    function onUninstall(bytes calldata) external {
        _requireIdle(msg.sender);
        delete $smartSessions[msg.sender];
        // Only a transient-storage read (`_requireIdle`) comes before: no external call.
        // forge-lint: disable-next-line(reentrancy-events)
        emit SessionHookUninstalled(msg.sender);
    }

    /// @notice Whether the hook is installed on `account`.
    function isInitialized(address account) external view returns (bool) {
        return $smartSessions[account] != address(0);
    }

    /// @notice Whether the hook is of ERC-7579 module type `moduleTypeId` (only hooks, type 4).
    function isModuleType(uint256 moduleTypeId) external pure returns (bool) {
        return moduleTypeId == MODULE_TYPE_HOOK;
    }

    // ---------------------------------------------------------------------------------------------
    // User operation policy (validation)
    // ---------------------------------------------------------------------------------------------

    /// @inheritdoc IPolicy
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IPolicy).interfaceId
            || interfaceId == type(IUserOpPolicy).interfaceId || interfaceId == 0x01ffc9a7;
    }

    /// @notice Sets the session's execution policies and initializes each. Called by Smart Sessions when it enables
    /// the session, during validation in enable mode.
    /// @param initData `abi.encode(ExecutionPolicyData[])`.
    function initializeWithMultiplexer(
        address account,
        bytes32 sessionConfigId,
        bytes calldata initData
    ) external {
        address smartSession = $smartSessions[account];
        if (smartSession == address(0)) revert SessionHookNotInstalled(account);
        if (msg.sender != smartSession) revert OnlySmartSession(msg.sender);

        ExecutionPolicyData[] memory list = abi.decode(initData, (ExecutionPolicyData[]));
        uint256 count = list.length;
        if (count > MAX_EXECUTION_POLICIES) revert TooManyExecutionPolicies(count);
        address[] memory policies = new address[](count);
        for (uint256 i; i < count; ++i) {
            address policy = list[i].policy;
            if (!_isExecutionPolicy(policy)) revert NotExecutionPolicy(policy);
            policies[i] = policy;
            $policies[sessionConfigId][i][account] = policy;
        }
        $counts[sessionConfigId][account] = count;
        emit ExecutionPoliciesSet(account, sessionConfigId, policies);

        // Initialized after the list is stored (checks-effects-interactions); at most MAX_EXECUTION_POLICIES.
        for (uint256 i; i < count; ++i) {
            // slither-disable-next-line calls-loop
            IExecutionPolicy(list[i].policy)
                .initializeWithMultiplexer(
                    account, policyConfigId(sessionConfigId, i), list[i].initData
                );
        }
    }

    /// @notice The session's validation-time conditions for its execution policies to run: the calldata names the
    /// session, the operation is a plain `execute` that calls none of the hook, the account and the session's
    /// execution policies, and the hook is installed on the account.
    function checkUserOpPolicy(bytes32 id, ERC4337.PackedUserOperation calldata userOp)
        external
        view
        returns (uint256)
    {
        address account = userOp.sender;
        address smartSession = $smartSessions[account];
        if (
            smartSession == address(0) || msg.sender != smartSession
                || !_isBound(account, smartSession)
        ) {
            return VALIDATION_FAILED;
        }

        bytes calldata callData = userOp.callData;
        (bool tagged, bytes32 permissionId) = _readTag(callData);
        if (!tagged || configId(account, permissionId) != id) return VALIDATION_FAILED;

        if (callData.length >= 4 && bytes4(callData[:4]) == EXECUTE_USER_OP_SELECTOR) {
            callData = callData[4:];
        }
        if (callData.length < 4 || bytes4(callData[:4]) != EXECUTE_SELECTOR) {
            return VALIDATION_FAILED;
        }
        return _callsAllowed(id, account, callData) ? VALIDATION_SUCCESS : VALIDATION_FAILED;
    }

    // ---------------------------------------------------------------------------------------------
    // ERC-7579 hook (execution)
    // ---------------------------------------------------------------------------------------------

    /// @notice Runs the tagged session's execution policies before the calls. Untagged operations, and calls other
    /// than `execute`, pass through.
    /// @return context `abi.encode(permissionId, policies, ids, contexts)`, or empty when nothing ran.
    function preCheck(address, uint256, bytes calldata msgData)
        external
        returns (bytes memory context)
    {
        address account = msg.sender;
        address smartSession = $smartSessions[account];
        if (smartSession == address(0)) return "";
        if (msgData.length < 4 || bytes4(msgData[:4]) != EXECUTE_SELECTOR) return "";
        (bool tagged, bytes32 permissionId) = _readTag(msgData);
        if (_loadContextHash(account) != bytes32(0)) revert ReentrantCheck(account);
        if (!tagged) {
            // Kernel runs the hook only around Smart Sessions' operations, so it holds the lock through untagged ones
            // too: their calls then can't reinstall or uninstall the hook (Kernel doesn't report a validator's hook as
            // installed, so Smart Sessions' fallback can't tell it is one). The owner's operations don't run it.
            context = abi.encode(bytes32(0), new address[](0), new bytes32[](0), new bytes[](0));
            _storeContextHash(account, keccak256(context));
            return context;
        }

        if (!_isPermissionEnabled(smartSession, account, permissionId)) {
            revert PermissionNotEnabled(permissionId);
        }

        // Locked while the policies run too, so none of them can re-enter a check for this account.
        _storeContextHash(account, bytes32(uint256(1)));
        context = _runPreChecks(account, permissionId, msgData);
        _storeContextHash(account, keccak256(context));
    }

    /// @notice Runs the session's execution policies after the calls. Works from `context` alone: the hook may have
    /// been uninstalled during the operation. Empty context: nothing ran, nothing to do.
    function postCheck(bytes calldata context) external {
        if (context.length == 0) return;
        address account = msg.sender;
        if (_loadContextHash(account) != keccak256(context)) revert InvalidContext(account);
        _storeContextHash(account, bytes32(0));

        (
            bytes32 permissionId,
            address[] memory policies,
            bytes32[] memory ids,
            bytes[] memory contexts
        ) = abi.decode(context, (bytes32, address[], bytes32[], bytes[]));
        uint256 count = policies.length;
        for (uint256 i; i < count; ++i) {
            _call(
                permissionId,
                policies[i],
                abi.encodeCall(IExecutionPolicy.postCheck, (ids[i], account, contexts[i]))
            );
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------------

    /// @notice The tail a session operation's calldata ends with.
    function tag(bytes32 permissionId) external pure returns (bytes memory) {
        return abi.encodePacked(permissionId, TAG);
    }

    /// @notice The Smart Sessions module whose sessions the hook serves on `account`, or zero if not installed.
    function getSmartSession(address account) external view returns (address) {
        return $smartSessions[account];
    }

    /// @notice The execution policies of `account`'s session `permissionId`.
    function getExecutionPolicies(address account, bytes32 permissionId)
        external
        view
        returns (address[] memory policies)
    {
        bytes32 id = configId(account, permissionId);
        uint256 count = $counts[id][account];
        policies = new address[](count);
        for (uint256 i; i < count; ++i) {
            policies[i] = $policies[id][i][account];
        }
    }

    /// @notice The configuration id Smart Sessions gives this hook as a session's user operation policy.
    function configId(address account, bytes32 permissionId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(account, permissionId));
    }

    /// @notice The configuration id of a session's `index`th execution policy.
    function policyConfigId(bytes32 sessionConfigId, uint256 index) public pure returns (bytes32) {
        return keccak256(abi.encode(sessionConfigId, index));
    }

    // ---------------------------------------------------------------------------------------------
    // Internal functions
    // ---------------------------------------------------------------------------------------------

    /// @dev The permission id of a tagged operation's calldata, and whether it is tagged.
    function _readTag(bytes calldata data) internal pure returns (bool, bytes32) {
        if (data.length < TAIL_LENGTH || bytes32(data[data.length - 32:]) != TAG) {
            return (false, bytes32(0));
        }
        return (true, bytes32(data[data.length - TAIL_LENGTH:data.length - 32]));
    }

    /// @dev Runs the session's execution policies' `preCheck`s and encodes what `postCheck` needs.
    function _runPreChecks(address account, bytes32 permissionId, bytes calldata execData)
        internal
        returns (bytes memory)
    {
        bytes32 id = configId(account, permissionId);
        uint256 count = $counts[id][account];
        address[] memory policies = new address[](count);
        bytes32[] memory ids = new bytes32[](count);
        bytes[] memory contexts = new bytes[](count);
        for (uint256 i; i < count; ++i) {
            policies[i] = $policies[id][i][account];
            ids[i] = policyConfigId(id, i);
            contexts[i] = _call(
                permissionId,
                policies[i],
                abi.encodeCall(IExecutionPolicy.preCheck, (ids[i], account, execData))
            );
        }
        return abi.encode(permissionId, policies, ids, contexts);
    }

    /// @dev Whether Kernel binds this hook to `smartSession`'s validation on `account` (rebinding never uninstalls the
    /// old hook, so the account is asked). A missing view reads as "not bound", failing validation instead of
    /// reverting it.
    // slither-disable-next-line low-level-calls
    function _isBound(address account, address smartSession) internal view returns (bool) {
        // Kernel's `validationConfig(validationId)` returns `(uint32 nonce, address hook)`.
        (bool success, bytes memory result) = account.staticcall(
            abi.encodeWithSignature(
                "validationConfig(bytes21)",
                // Exactly 21 bytes: validation type 0x01 (validator) ‖ address.
                // forge-lint: disable-next-line(unsafe-typecast)
                bytes21(abi.encodePacked(bytes1(0x01), smartSession))
            )
        );
        if (!success || result.length != 64) return false;
        (, address hook) = abi.decode(result, (uint32, address));
        return hook == address(this);
    }

    /// @dev Whether every call of `execute` calldata avoids the hook, the account and the session's execution
    /// policies: calling them mid-operation could reset what the policies measure.
    function _callsAllowed(bytes32 id, address account, bytes calldata executeCallData)
        internal
        view
        returns (bool)
    {
        bytes32 mode = bytes32(executeCallData[4:36]);
        bytes calldata executionCalldata = ExecutionLib.decodeUserOpCallData(executeCallData);
        bytes1 callType = LibERC7579.getCallType(mode);
        if (callType == LibERC7579.CALLTYPE_SINGLE) {
            if (executionCalldata.length < 20) return false;
            return _targetAllowed(id, account, address(bytes20(executionCalldata[:20])));
        }
        if (callType != LibERC7579.CALLTYPE_BATCH) return false;
        Execution[] calldata executions = ExecutionLib.decodeBatch(executionCalldata);
        uint256 length = executions.length;
        for (uint256 i; i < length; ++i) {
            if (!_targetAllowed(id, account, executions[i].target)) return false;
        }
        return true;
    }

    function _targetAllowed(bytes32 id, address account, address target)
        internal
        view
        returns (bool)
    {
        if (target == address(this) || target == account) return false;
        uint256 count = $counts[id][account];
        for (uint256 i; i < count; ++i) {
            if ($policies[id][i][account] == target) return false;
        }
        return true;
    }

    /// @dev The session is still enabled with this hook among its user operation policies.
    // slither-disable-next-line low-level-calls
    function _isPermissionEnabled(address smartSession, address account, bytes32 permissionId)
        internal
        view
        returns (bool)
    {
        (bool enabled, bytes memory result) = smartSession.staticcall(
            abi.encodeWithSignature("isPermissionEnabled(bytes32,address)", permissionId, account)
        );
        if (!enabled || result.length != 32 || !abi.decode(result, (bool))) return false;
        (bool listed, bytes memory hasHook) = smartSession.staticcall(
            abi.encodeWithSignature(
                "isUserOpPolicyEnabled(address,bytes32,address)",
                account,
                permissionId,
                address(this)
            )
        );
        return listed && hasHook.length == 32 && abi.decode(hasHook, (bool));
    }

    // slither-disable-next-line low-level-calls,calls-loop
    function _isExecutionPolicy(address policy) internal view returns (bool) {
        if (policy.code.length == 0) return false;
        (bool success, bytes memory result) = policy.staticcall(
            abi.encodeCall(IPolicy.supportsInterface, (type(IExecutionPolicy).interfaceId))
        );
        return success && result.length == 32 && abi.decode(result, (bool));
    }

    /// @dev Calls a policy; any revert (out of gas included) rejects the operation, never caught silently. Called once
    /// per policy, at most MAX_EXECUTION_POLICIES.
    // slither-disable-next-line low-level-calls,calls-loop
    function _call(bytes32 permissionId, address policy, bytes memory data)
        internal
        returns (bytes memory result)
    {
        bool success;
        (success, result) = policy.call(data);
        if (!success) revert ExecutionPolicyViolation(permissionId, policy, result);
        if (result.length != 0) result = abi.decode(result, (bytes));
    }

    /// @dev Refuses while one of the account's session operations is between `preCheck` and `postCheck`.
    function _requireIdle(address account) internal view {
        if (_loadContextHash(account) != bytes32(0)) revert ReentrantCheck(account);
    }

    function _contextSlot(address account) internal pure returns (bytes32) {
        return keccak256(abi.encode(CONTEXT_SLOT, account));
    }

    function _loadContextHash(address account) internal view returns (bytes32 value) {
        bytes32 slot = _contextSlot(account);
        assembly ("memory-safe") {
            value := tload(slot)
        }
    }

    function _storeContextHash(address account, bytes32 value) internal {
        bytes32 slot = _contextSlot(account);
        assembly ("memory-safe") {
            tstore(slot, value)
        }
    }
}
