// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {SessionHook} from "src/hooks/SessionHook.sol";
import {AllowPolicy} from "src/policies/AllowPolicy.sol";
import {PermissionId, Session} from "src/smart-sessions/DataTypes.sol";
import {ISessionValidator} from "src/smart-sessions/interfaces/ISessionValidator.sol";
import {Execution} from "src/smart-sessions/lib/ExecutionLib.sol";

import {IEntryPoint} from "../utils/EntryPoint.sol";
import {SessionBuilder} from "../utils/SessionBuilder.sol";
import {MockExecutionPolicy} from "../utils/mocks/MockExecutionPolicy.sol";
import {MockTarget} from "../utils/mocks/MockTarget.sol";
import {RealAccountTestBase} from "./RealAccountTestBase.sol";

/// @notice Execution policies through SessionHook on a real account: every account test with SessionHook runs these,
/// on top of the session flows of `RealAccountTestBase`, which run untagged and pass through the hook.
abstract contract SessionHookFlows is RealAccountTestBase {
    using SessionBuilder for Session;

    MockExecutionPolicy internal executionPolicy;

    function setUp() public virtual override {
        super.setUp();
        executionPolicy = new MockExecutionPolicy();
    }

    /// @dev A session allowed to call `target.setValue`, with SessionHook running one mock execution policy.
    function hookedSession(bytes32 salt, MockExecutionPolicy.Mode mode)
        internal
        returns (Session memory)
    {
        SessionHook.ExecutionPolicyData[] memory policies = new SessionHook.ExecutionPolicyData[](1);
        policies[0] = SessionHook.ExecutionPolicyData(address(executionPolicy), abi.encode(mode));
        return SessionBuilder.create(
                ISessionValidator(address(sessionValidator)),
                SessionBuilder.ecdsaConfig(sessionSigner),
                salt
            )
            .withAction(
                address(target), MockTarget.setValue.selector, address(new AllowPolicy()), ""
            )
            .withUserOpPolicy(address(sessionHook), abi.encode(policies));
    }

    function tagged(bytes memory callData, PermissionId permissionId)
        internal
        view
        returns (bytes memory)
    {
        return abi.encodePacked(callData, sessionHook.tag(PermissionId.unwrap(permissionId)));
    }

    function test_hook_executionPoliciesRunAroundTheCalls() public {
        Session memory session = hookedSession("run", MockExecutionPolicy.Mode.Pass);
        PermissionId permissionId = smartSession.getPermissionId(session);

        handleOp(signEnable(userOp(smartAccount, tagged(callSetValue(7), permissionId)), session));

        assertEq(target.value(), 7);
        assertEq(executionPolicy.preChecks(smartAccount), 1);
        assertEq(executionPolicy.postChecks(smartAccount), 1);
        // The policy saw the `execute` calldata, tail included.
        assertEq(executionPolicy.lastExecData(), tagged(callSetValue(7), permissionId));
        assertEq(
            sessionHook.getExecutionPolicies(smartAccount, PermissionId.unwrap(permissionId))[0],
            address(executionPolicy)
        );
    }

    function test_hook_aFailingPolicyRevertsTheExecution() public {
        Session memory session = hookedSession("post", MockExecutionPolicy.Mode.RevertPost);
        PermissionId permissionId = smartSession.getPermissionId(session);
        handleOp(signEnable(userOp(smartAccount, tagged(callSetValue(7), permissionId)), session));

        // Validated (the session is enabled), executed and rolled back.
        assertTrue(smartSession.isPermissionEnabled(permissionId, smartAccount));
        assertEq(target.value(), 0);
        assertEq(executionPolicy.postChecks(smartAccount), 0);
    }

    function test_hook_anUntaggedOperationFailsValidation() public {
        Session memory session = hookedSession("untagged", MockExecutionPolicy.Mode.Pass);
        ERC4337.PackedUserOperation memory op =
            signEnable(userOp(smartAccount, callSetValue(7)), session);

        vm.expectPartialRevert(IEntryPoint.FailedOpWithRevert.selector);
        handleOp(op);
        assertEq(target.value(), 0);
    }

    /// @dev Another session can't run this one's execution policies (and change their state) with its own operation.
    function test_hook_anotherSessionsTagFailsValidation() public {
        Session memory hooked = hookedSession("victim", MockExecutionPolicy.Mode.Pass);
        PermissionId victim = smartSession.getPermissionId(hooked);
        handleOp(signEnable(userOp(smartAccount, tagged(callSetValue(1), victim)), hooked));

        Session memory plain = defaultSession();
        ERC4337.PackedUserOperation memory op =
            signEnable(userOp(smartAccount, tagged(callSetValue(2), victim)), plain);
        vm.expectPartialRevert(IEntryPoint.FailedOpWithRevert.selector);
        handleOp(op);
        assertEq(executionPolicy.preChecks(smartAccount), 1);
    }

    /// @dev Calldata, not state, names the session: two operations with identical calldata in one bundle each run
    /// the policies.
    function test_hook_identicalOperationsInOneBundleEachRunThePolicies() public {
        Session memory session = hookedSession("twice", MockExecutionPolicy.Mode.Pass);
        PermissionId permissionId = smartSession.getPermissionId(session);
        handleOp(signEnable(userOp(smartAccount, tagged(callSetValue(1), permissionId)), session));

        bytes memory callData = tagged(callSetValue(5), permissionId);
        ERC4337.PackedUserOperation[] memory ops = new ERC4337.PackedUserOperation[](2);
        ops[0] = signUse(userOp(smartAccount, callData), permissionId);
        // A separate struct: assigning `ops[0]` would alias it.
        ERC4337.PackedUserOperation memory second = userOp(smartAccount, callData);
        second.nonce = ops[0].nonce + 1;
        ops[1] = signUse(second, permissionId);
        entryPoint.handleOps(ops, payable(makeAddr("beneficiary")));

        assertEq(executionPolicy.preChecks(smartAccount), 3);
        assertEq(executionPolicy.postChecks(smartAccount), 3);
    }

    /// @dev A session may not call the hook or its execution policies mid-operation, even with an action policy
    /// that allows any call.
    function test_hook_callingTheHookOrAPolicyFailsValidation() public {
        Session memory session = hookedSession("self", MockExecutionPolicy.Mode.Pass)
            .withFallbackAction(address(new AllowPolicy()), "");
        PermissionId permissionId = smartSession.getPermissionId(session);
        handleOp(signEnable(userOp(smartAccount, tagged(callSetValue(1), permissionId)), session));

        address[3] memory forbidden = [address(sessionHook), address(executionPolicy), smartAccount];
        for (uint256 i; i < forbidden.length; ++i) {
            Execution[] memory batch = new Execution[](2);
            batch[0] = Execution(address(target), 0, abi.encodeCall(MockTarget.setValue, (9)));
            batch[1] = Execution(forbidden[i], 0, abi.encodeCall(SessionHook.postCheck, ("")));
            ERC4337.PackedUserOperation memory op = signUse(
                userOp(smartAccount, tagged(executeBatch(batch), permissionId)), permissionId
            );
            vm.expectPartialRevert(IEntryPoint.FailedOpWithRevert.selector);
            handleOp(op);
        }
        assertEq(target.value(), 1);
    }

    /// @dev With the hook no longer running for SmartSession's operations, sessions with execution policies fail
    /// validation instead of running unchecked.
    function test_hook_unboundHookFailsValidation() public {
        Session memory session = hookedSession("unbound", MockExecutionPolicy.Mode.Pass);
        PermissionId permissionId = smartSession.getPermissionId(session);
        handleOp(signEnable(userOp(smartAccount, tagged(callSetValue(1), permissionId)), session));

        unbindSessionHook();
        ERC4337.PackedUserOperation memory op =
            signUse(userOp(smartAccount, tagged(callSetValue(2), permissionId)), permissionId);
        vm.expectPartialRevert(IEntryPoint.FailedOpWithRevert.selector);
        handleOp(op);
        assertEq(target.value(), 1);
    }

    /// @dev Removes SessionHook from SmartSession's operations the way the account allows.
    function unbindSessionHook() internal virtual;
}
