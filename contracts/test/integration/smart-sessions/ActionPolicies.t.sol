// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";
import {LibERC7579} from "solady/accounts/LibERC7579.sol";

import {FALLBACK_TARGET_FLAG, PermissionId, Session} from "src/smart-sessions/DataTypes.sol";
import {ISmartSession} from "src/smart-sessions/ISmartSession.sol";
import {ISessionValidator} from "src/smart-sessions/interfaces/ISessionValidator.sol";
import {Execution} from "src/smart-sessions/lib/ExecutionLib.sol";

import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";
import {MockAccount} from "../../utils/mocks/MockAccount.sol";
import {MockPolicyConfig} from "../../utils/mocks/MockPolicy.sol";
import {MockTarget} from "../../utils/mocks/MockTarget.sol";

contract ActionPoliciesTest is SmartSessionTestBase {
    using SessionBuilder for Session;

    bytes4 internal constant VALUE_SELECTOR = 0xFFFFFFFF;

    function test_singleCall_passesCallDetailsToActionPolicy() public {
        PermissionId permissionId = enableSession(defaultSession());
        bytes memory data = abi.encodeCall(MockTarget.setValue, (7));

        handleOp(signUse(userOp(executeSingle(address(target), 0, data)), permissionId));

        (address calledTarget, uint256 value, bytes memory calledData) = policy.lastAction();
        assertEq(calledTarget, address(target));
        assertEq(value, 0);
        assertEq(calledData, data);
        assertEq(target.value(), 7);
    }

    function test_RevertWhen_actionHasNoPoliciesAndNoFallback() public {
        PermissionId permissionId = enableSession(defaultSession());
        MockTarget otherTarget = new MockTarget();
        ERC4337.PackedUserOperation memory op = signUse(
            userOp(
                executeSingle(address(otherTarget), 0, abi.encodeCall(MockTarget.setValue, (1)))
            ),
            permissionId
        );

        vm.expectRevert(abi.encodeWithSelector(ISmartSession.NoPoliciesSet.selector, permissionId));
        validate(op);
    }

    function test_RevertWhen_actionPolicyRejects() public {
        Session memory session = _emptySession()
            .withAction(address(target), SET_VALUE, address(policy), MockPolicyConfig.deny());
        PermissionId permissionId = enableSession(session);
        ERC4337.PackedUserOperation memory op = signUse(userOp(callSetValue(1)), permissionId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ISmartSession.PolicyViolation.selector, permissionId, address(policy)
            )
        );
        validate(op);
    }

    function test_fallbackAction_coversActionsWithoutPolicies() public {
        Session memory session =
            _emptySession().withFallbackAction(address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);

        handleOp(signUse(userOp(callSetValue(3)), permissionId));

        assertEq(target.value(), 3);
    }

    function test_actionPolicies_takePrecedenceOverFallback() public {
        Session memory session = _emptySession()
            .withAction(address(target), SET_VALUE, address(policy), MockPolicyConfig.deny())
            .withFallbackAction(address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);
        ERC4337.PackedUserOperation memory op = signUse(userOp(callSetValue(1)), permissionId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ISmartSession.PolicyViolation.selector, permissionId, address(policy)
            )
        );
        validate(op);
    }

    function test_valueTransfer_usesValueSelectorAction() public {
        Session memory session = _emptySession()
            .withAction(address(target), VALUE_SELECTOR, address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);

        handleOp(signUse(userOp(executeSingle(address(target), 1 ether, "")), permissionId));

        assertEq(target.received(), 1 ether);
    }

    function test_batch_checksEveryExecution() public {
        PermissionId permissionId = enableSession(defaultSession());
        Execution[] memory executions = new Execution[](2);
        executions[0] = Execution(address(target), 0, abi.encodeCall(MockTarget.setValue, (1)));
        executions[1] = Execution(address(target), 0, abi.encodeCall(MockTarget.setValue, (2)));

        handleOp(signUse(userOp(executeBatch(executions)), permissionId));

        assertEq(target.calls(), 2);
        assertEq(target.value(), 2);
    }

    function test_RevertWhen_oneBatchExecutionHasNoPolicy() public {
        PermissionId permissionId = enableSession(defaultSession());
        Execution[] memory executions = new Execution[](2);
        executions[0] = Execution(address(target), 0, abi.encodeCall(MockTarget.setValue, (1)));
        executions[1] = Execution(makeAddr("unlisted"), 0, "");
        ERC4337.PackedUserOperation memory op =
            signUse(userOp(executeBatch(executions)), permissionId);

        vm.expectRevert(abi.encodeWithSelector(ISmartSession.NoPoliciesSet.selector, permissionId));
        validate(op);
    }

    function test_RevertWhen_batchIsEmpty() public {
        PermissionId permissionId = enableSession(defaultSession());
        ERC4337.PackedUserOperation memory op =
            signUse(userOp(executeBatch(new Execution[](0))), permissionId);

        vm.expectRevert(ISmartSession.NoExecutionsInBatch.selector);
        validate(op);
    }

    function test_RevertWhen_executionCallsAccountExecute() public {
        Session memory session =
            _emptySession().withFallbackAction(address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);
        bytes memory nested = callSetValue(1);
        ERC4337.PackedUserOperation memory op =
            signUse(userOp(executeSingle(address(account), 0, nested)), permissionId);

        vm.expectRevert(ISmartSession.InvalidSelfCall.selector);
        validate(op);
    }

    function test_RevertWhen_targetIsFallbackFlag() public {
        Session memory session =
            _emptySession().withFallbackAction(address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);
        ERC4337.PackedUserOperation memory op =
            signUse(userOp(executeSingle(FALLBACK_TARGET_FLAG, 0, "")), permissionId);

        vm.expectRevert(ISmartSession.InvalidTarget.selector);
        validate(op);
    }

    function test_RevertWhen_callIntoModuleIsNotPermitted() public {
        Session memory session =
            _emptySession().withFallbackAction(address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);
        bytes memory removeCall = abi.encodeCall(ISmartSession.removeSession, (permissionId));
        ERC4337.PackedUserOperation memory op =
            signUse(userOp(executeSingle(address(smartSession), 0, removeCall)), permissionId);

        vm.expectRevert(abi.encodeWithSelector(ISmartSession.NoPoliciesSet.selector, permissionId));
        validate(op);
    }

    function test_callIntoModule_isAllowedWithModuleCallAction() public {
        Session memory session =
            _emptySession().withModuleCallAction(address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);
        bytes memory revokeCall =
            abi.encodeCall(ISmartSession.revokeEnableSignature, (permissionId));

        handleOp(signUse(userOp(executeSingle(address(smartSession), 0, revokeCall)), permissionId));

        assertEq(smartSession.getNonce(permissionId, address(account)), 1);
    }

    function test_accountFunction_isCheckedAsActionOnAccount() public {
        bytes4 selector = MockAccount.uninstallModule.selector;
        Session memory session = _emptySession()
            .withAction(address(account), selector, address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);
        bytes memory callData = abi.encodeWithSelector(selector, 2, makeAddr("module"), "");

        assertEq(validate(signUse(userOp(callData), permissionId)), VALID);
    }

    function test_RevertWhen_accountFunctionHasNoPolicy() public {
        PermissionId permissionId = enableSession(defaultSession());
        bytes memory callData =
            abi.encodeCall(MockAccount.uninstallModule, (2, makeAddr("module"), ""));
        ERC4337.PackedUserOperation memory op = signUse(userOp(callData), permissionId);

        vm.expectRevert(abi.encodeWithSelector(ISmartSession.NoPoliciesSet.selector, permissionId));
        validate(op);
    }

    function test_RevertWhen_execTypeIsTry() public {
        PermissionId permissionId = enableSession(defaultSession());
        bytes32 mode = LibERC7579.encodeMode(
            LibERC7579.CALLTYPE_SINGLE, LibERC7579.EXECTYPE_TRY, bytes4(0), bytes22(0)
        );
        bytes memory callData = abi.encodeCall(
            MockAccount.execute, (mode, abi.encodePacked(address(target), uint256(0), ""))
        );
        ERC4337.PackedUserOperation memory op = signUse(userOp(callData), permissionId);

        vm.expectRevert(ISmartSession.UnsupportedExecutionType.selector);
        validate(op);
    }

    function test_RevertWhen_callTypeIsDelegatecall() public {
        PermissionId permissionId = enableSession(defaultSession());
        bytes32 mode = LibERC7579.encodeMode(
            LibERC7579.CALLTYPE_DELEGATECALL, LibERC7579.EXECTYPE_DEFAULT, bytes4(0), bytes22(0)
        );
        bytes memory callData =
            abi.encodeCall(MockAccount.execute, (mode, abi.encodePacked(address(target), "")));
        ERC4337.PackedUserOperation memory op = signUse(userOp(callData), permissionId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ISmartSession.UnsupportedCallType.selector, LibERC7579.CALLTYPE_DELEGATECALL
            )
        );
        validate(op);
    }

    function test_userOpAndActionTimeBounds_areIntersected() public {
        uint256 userOpBounds = (uint256(3000) << 160) | (uint256(1000) << 208);
        uint256 actionBounds = (uint256(4000) << 160) | (uint256(2000) << 208);
        Session memory session = _emptySession()
            .withUserOpPolicy(address(policy), MockPolicyConfig.returning(userOpBounds))
            .withAction(
                address(target),
                SET_VALUE,
                address(policy),
                MockPolicyConfig.returning(actionBounds)
            );
        PermissionId permissionId = enableSession(session);

        uint256 validationData = validate(signUse(userOp(callSetValue(1)), permissionId));

        assertEq(validationData, (uint256(3000) << 160) | (uint256(2000) << 208));
    }

    function _emptySession() internal view returns (Session memory) {
        return SessionBuilder.create(
            ISessionValidator(address(sessionValidator)),
            SessionBuilder.ecdsaConfig(sessionSigner),
            keccak256("actions")
        );
    }
}
