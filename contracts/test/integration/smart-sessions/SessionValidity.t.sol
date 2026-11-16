// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {PermissionId, Session} from "src/smart-sessions/DataTypes.sol";
import {ISmartSession} from "src/smart-sessions/ISmartSession.sol";

import {IEntryPoint} from "../../utils/EntryPoint.sol";
import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";
import {MockPolicyConfig} from "../../utils/mocks/MockPolicy.sol";

contract SessionValidityTest is SmartSessionTestBase {
    using SessionBuilder for Session;

    uint48 internal constant START = 1_000_000;
    uint48 internal constant END = 2_000_000;

    function setUp() public override {
        super.setUp();
        vm.warp(START - 100);
    }

    function test_windowIsReturnedAsValidationData() public {
        PermissionId permissionId = enableSession(defaultSession().withValidity(START, END));

        uint256 validationData = validate(signUse(userOp(callSetValue(1)), permissionId));

        assertEq(validationData, _bounds(START, END));
    }

    function test_unboundedWindow_neverExpires() public {
        PermissionId permissionId = enableSession(defaultSession());

        assertEq(validate(signUse(userOp(callSetValue(1)), permissionId)), VALID);
    }

    function test_windowIntersectsWithPolicyBounds() public {
        uint256 policyBounds = _bounds(START + 10, END + 10);
        Session memory session = defaultSession()
            .withValidity(START, END)
            .withUserOpPolicy(address(policy), MockPolicyConfig.returning(policyBounds));
        PermissionId permissionId = enableSession(session);

        uint256 validationData = validate(signUse(userOp(callSetValue(1)), permissionId));

        assertEq(validationData, _bounds(START + 10, END));
    }

    function test_entryPointRejectsOpBeforeStart() public {
        PermissionId permissionId = enableSession(defaultSession().withValidity(START, END));
        ERC4337.PackedUserOperation memory op = signUse(userOp(callSetValue(1)), permissionId);

        vm.expectRevert(
            abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, "AA22 expired or not due")
        );
        handleOp(op);
    }

    function test_entryPointAcceptsOpInsideWindow() public {
        PermissionId permissionId = enableSession(defaultSession().withValidity(START, END));
        vm.warp(START + 1);

        handleOp(signUse(userOp(callSetValue(8)), permissionId));

        assertEq(target.value(), 8);
    }

    function test_entryPointRejectsOpAfterEnd() public {
        PermissionId permissionId = enableSession(defaultSession().withValidity(START, END));
        vm.warp(END + 1);
        ERC4337.PackedUserOperation memory op = signUse(userOp(callSetValue(1)), permissionId);

        vm.expectRevert(
            abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, "AA22 expired or not due")
        );
        handleOp(op);
    }

    function test_RevertWhen_windowIsEmpty() public {
        vm.expectRevert(
            abi.encodeWithSelector(ISmartSession.InvalidSessionValidity.selector, END, END)
        );
        enableSession(defaultSession().withValidity(END, END));
    }

    function test_onlyStartBound_isAllowed() public {
        PermissionId permissionId = enableSession(defaultSession().withValidity(START, 0));

        uint256 validationData = validate(signUse(userOp(callSetValue(1)), permissionId));

        assertEq(validationData, _bounds(START, type(uint48).max));
    }

    function testFuzz_windowIsStoredAsSigned(uint48 validAfter, uint48 validUntil) public {
        vm.assume(validUntil == 0 || validAfter < validUntil);
        PermissionId permissionId =
            enableSession(defaultSession().withValidity(validAfter, validUntil));

        (uint48 storedAfter, uint48 storedUntil) =
            smartSession.getSessionValidity(permissionId, address(account));

        assertEq(storedAfter, validAfter);
        assertEq(storedUntil, validUntil);
    }

    function _bounds(uint48 validAfter, uint48 validUntil) internal pure returns (uint256) {
        return (uint256(validUntil) << 160) | (uint256(validAfter) << 208);
    }
}
