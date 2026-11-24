// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {ConfigId, PermissionId, Session, SmartSessionMode} from "src/smart-sessions/DataTypes.sol";
import {ISmartSession} from "src/smart-sessions/ISmartSession.sol";

import {IEntryPoint} from "../../utils/EntryPoint.sol";
import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";
import {MockPolicy, MockPolicyConfig} from "../../utils/mocks/MockPolicy.sol";

contract UserOpValidationTest is SmartSessionTestBase {
    using SessionBuilder for Session;

    function test_RevertWhen_permissionNotEnabled() public {
        PermissionId permissionId = smartSession.getPermissionId(defaultSession());
        ERC4337.PackedUserOperation memory op = signUse(userOp(callSetValue(1)), permissionId);

        vm.expectRevert(
            abi.encodeWithSelector(ISmartSession.InvalidPermissionId.selector, permissionId)
        );
        validate(op);
    }

    function testFuzz_RevertWhen_callerIsNotTheSender(address caller) public {
        vm.assume(caller != address(account));
        PermissionId permissionId = enableSession(defaultSession());
        ERC4337.PackedUserOperation memory op = signUse(userOp(callSetValue(1)), permissionId);
        bytes32 opHash = userOpHash(op);

        vm.prank(caller);
        vm.expectRevert(
            abi.encodeWithSelector(ISmartSession.InvalidUserOpSender.selector, address(account))
        );
        smartSession.validateUserOp(op, opHash);
    }

    /// @dev Regression (permission id binding): the session key signs the permission id with the operation, so an
    /// operation signed for one session can't be used with another session of the same key.
    function test_operationSignedForAnotherSessionOfTheKey_isRejected() public {
        PermissionId signedFor = enableSession(defaultSession());
        Session memory other = defaultSession();
        other.salt = keccak256("other");
        PermissionId usedWith = enableSession(other);
        ERC4337.PackedUserOperation memory op = userOp(callSetValue(1));

        op.signature = abi.encodePacked(
            SmartSessionMode.USE, usedWith, signUserOpHash(op, signedFor, sessionKey)
        );
        assertEq(validate(op), SIG_FAILED);

        assertEq(validate(signUse(op, usedWith)), VALID);
    }

    function test_RevertWhen_modeIsUnknown() public {
        PermissionId permissionId = enableSession(defaultSession());
        ERC4337.PackedUserOperation memory op = userOp(callSetValue(1));
        op.signature =
            abi.encodePacked(uint8(3), permissionId, signUserOpHash(op, permissionId, sessionKey));

        vm.expectRevert();
        validate(op);
    }

    function test_userOpPolicyTimeBounds_areReturned() public {
        uint256 bounds = (uint256(2000) << 160) | (uint256(1000) << 208);
        Session memory session =
            defaultSession().withUserOpPolicy(address(policy), MockPolicyConfig.returning(bounds));
        PermissionId permissionId = enableSession(session);

        assertEq(validate(signUse(userOp(callSetValue(1)), permissionId)), bounds);
    }

    function test_userOpPolicyIsCheckedForEveryOpOfTheAccount() public {
        MockPolicy userOpPolicy = new MockPolicy(true);
        Session memory session =
            defaultSession().withUserOpPolicy(address(userOpPolicy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);
        ConfigId configId =
            ConfigId.wrap(keccak256(abi.encodePacked(address(account), permissionId)));

        handleOp(signUse(userOp(callSetValue(1)), permissionId));
        handleOp(signUse(userOp(callSetValue(2)), permissionId));

        assertEq(userOpPolicy.checkCount(configId, address(smartSession), address(account)), 2);
    }

    function test_RevertWhen_userOpPolicyRejects() public {
        Session memory session =
            defaultSession().withUserOpPolicy(address(policy), MockPolicyConfig.deny());
        PermissionId permissionId = enableSession(session);

        ERC4337.PackedUserOperation memory op = signUse(userOp(callSetValue(1)), permissionId);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISmartSession.PolicyViolation.selector, permissionId, address(policy)
            )
        );
        validate(op);
    }

    function test_RevertWhen_userOpPolicyReturnsAggregator() public {
        uint256 aggregator = uint256(uint160(makeAddr("aggregator")));
        Session memory session = defaultSession()
            .withUserOpPolicy(address(policy), MockPolicyConfig.returning(aggregator));
        PermissionId permissionId = enableSession(session);

        ERC4337.PackedUserOperation memory op = signUse(userOp(callSetValue(1)), permissionId);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISmartSession.PolicyViolation.selector, permissionId, address(policy)
            )
        );
        validate(op);
    }

    function test_RevertWhen_userOpPolicyReverts() public {
        Session memory session =
            defaultSession().withUserOpPolicy(address(policy), MockPolicyConfig.reverting());
        PermissionId permissionId = enableSession(session);

        ERC4337.PackedUserOperation memory op = signUse(userOp(callSetValue(1)), permissionId);
        vm.expectRevert(
            abi.encodeWithSignature(
                "PolicyCheckReverted(bytes32)", bytes32(MockPolicy.CheckReverted.selector)
            )
        );
        validate(op);
    }

    function test_RevertWhen_paymasterIsNotPermitted() public {
        PermissionId permissionId = enableSession(defaultSession());
        ERC4337.PackedUserOperation memory op = userOp(callSetValue(1));
        op.paymasterAndData = abi.encodePacked(makeAddr("paymaster"), uint128(1e5), uint128(1e5));

        vm.expectRevert(
            abi.encodeWithSelector(
                ISmartSession.PaymasterValidationNotEnabled.selector, permissionId
            )
        );
        validate(signUse(op, permissionId));
    }

    function test_RevertWhen_paymasterIsPermittedWithoutUserOpPolicy() public {
        PermissionId permissionId = enableSession(defaultSession().withPaymaster());
        ERC4337.PackedUserOperation memory op = userOp(callSetValue(1));
        op.paymasterAndData = abi.encodePacked(makeAddr("paymaster"), uint128(1e5), uint128(1e5));

        vm.expectRevert(abi.encodeWithSelector(ISmartSession.NoPoliciesSet.selector, permissionId));
        validate(signUse(op, permissionId));
    }

    function test_paymasterIsAllowedWithPermitAndUserOpPolicy() public {
        Session memory session = defaultSession()
            .withPaymaster()
            .withUserOpPolicy(address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);
        ERC4337.PackedUserOperation memory op = userOp(callSetValue(1));
        op.paymasterAndData = abi.encodePacked(makeAddr("paymaster"), uint128(1e5), uint128(1e5));

        assertEq(validate(signUse(op, permissionId)), VALID);
    }

    function test_RevertWhen_executeUserOpIsUsed() public {
        PermissionId permissionId = enableSession(defaultSession());
        bytes memory callData = abi.encodeWithSelector(bytes4(0x8dd7712f), new bytes(0));

        ERC4337.PackedUserOperation memory op = signUse(userOp(callData), permissionId);
        vm.expectRevert(ISmartSession.UnsupportedExecutionType.selector);
        validate(op);
    }

    function test_RevertWhen_entryPointRejectsInvalidSignature() public {
        PermissionId permissionId = enableSession(defaultSession());
        ERC4337.PackedUserOperation memory op = userOp(callSetValue(1));
        (, uint256 otherKey) = makeAddrAndKey("other");
        op.signature =
            abi.encodePacked(uint8(0), permissionId, signUserOpHash(op, permissionId, otherKey));

        vm.expectRevert(
            abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, "AA24 signature error")
        );
        handleOp(op);
    }
}
