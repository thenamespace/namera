// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {AllowPolicy} from "src/policies/AllowPolicy.sol";
import {ArgPolicy} from "src/policies/ArgPolicy.sol";
import {RateLimitPolicy} from "src/policies/RateLimitPolicy.sol";
import {SpendPolicy} from "src/policies/SpendPolicy.sol";
import {Conditions} from "src/policies/lib/Conditions.sol";
import {PermissionId, Session} from "src/smart-sessions/DataTypes.sol";
import {ISmartSession} from "src/smart-sessions/ISmartSession.sol";
import {ISessionValidator} from "src/smart-sessions/interfaces/ISessionValidator.sol";

import {IEntryPoint} from "../../utils/EntryPoint.sol";
import {PolicyCalls} from "../../utils/PolicyCalls.sol";
import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";
import {MockERC20} from "../../utils/mocks/MockERC20.sol";

/// @notice Namera's policies through SmartSession and the EntryPoint: the EntryPoint enforces the period bounds the
/// limit policies return, so only the true current period can be charged.
contract PoliciesIntegrationTest is SmartSessionTestBase {
    using SessionBuilder for Session;

    uint256 internal constant DAY = 1 days;
    uint256 internal constant T = 20_000 days + 100;

    AllowPolicy internal allow;
    ArgPolicy internal args;
    SpendPolicy internal spend;
    RateLimitPolicy internal rateLimit;
    MockERC20 internal token;
    address internal recipient = makeAddr("recipient");

    function setUp() public override {
        super.setUp();
        allow = new AllowPolicy();
        args = new ArgPolicy();
        spend = new SpendPolicy();
        rateLimit = new RateLimitPolicy();
        token = new MockERC20();
        token.mint(address(account), 1000);
        vm.warp(T);
    }

    function _session() internal view returns (Session memory) {
        return SessionBuilder.create(
            ISessionValidator(address(sessionValidator)),
            SessionBuilder.ecdsaConfig(sessionSigner),
            keccak256("policies")
        );
    }

    function _transfer(uint256 amount, uint256 t) internal view returns (bytes memory) {
        return PolicyCalls.withTime(
            PolicyCalls.single(address(token), 0, PolicyCalls.transfer(recipient, amount)), t
        );
    }

    function _spendSession(uint256 budget) internal returns (PermissionId) {
        SpendPolicy.Limit[] memory limits = new SpendPolicy.Limit[](1);
        limits[0] = SpendPolicy.Limit(address(token), budget, DAY, true);
        return enableSession(
            _session()
                .withAction(address(token), bytes4(0xa9059cbb), address(allow), "")
                .withUserOpPolicy(address(spend), abi.encode(limits))
        );
    }

    function _rejected(ERC4337.PackedUserOperation memory op, string memory reason) internal {
        vm.expectRevert(abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, reason));
        handleOp(op);
    }

    function test_argumentConditionsAllowTheBoundaryAndRejectOneMore() public {
        ArgPolicy.Rule[] memory rules = new ArgPolicy.Rule[](1);
        rules[0].condition = Conditions.Condition.Lte;
        rules[0].offset = 0;
        rules[0].refs = new bytes32[](1);
        rules[0].refs[0] = bytes32(uint256(10));
        PermissionId permissionId = enableSession(
            _session().withAction(address(target), SET_VALUE, address(args), abi.encode(rules))
        );

        handleOp(signUse(userOp(callSetValue(10)), permissionId));
        assertEq(target.value(), 10);

        ERC4337.PackedUserOperation memory op = signUse(userOp(callSetValue(11)), permissionId);
        vm.expectPartialRevert(IEntryPoint.FailedOpWithRevert.selector);
        handleOp(op);
    }

    function test_aSpendBudgetHoldsPerDayAndRollsOverAtTheBoundary() public {
        PermissionId permissionId = _spendSession(100);

        handleOp(signUse(userOp(_transfer(60, T)), permissionId));
        ERC4337.PackedUserOperation memory over = signUse(userOp(_transfer(50, T)), permissionId);
        vm.expectPartialRevert(IEntryPoint.FailedOpWithRevert.selector);
        handleOp(over);

        uint256 nextDay = (T / DAY + 1) * DAY;
        vm.warp(nextDay);
        handleOp(signUse(userOp(_transfer(100, nextDay)), permissionId));
        assertEq(token.balanceOf(recipient), 160);
    }

    function test_theEntryPointRejectsAClaimedFuturePeriod() public {
        PermissionId permissionId = _spendSession(100);
        handleOp(signUse(userOp(_transfer(100, T)), permissionId));

        _rejected(signUse(userOp(_transfer(100, T + DAY)), permissionId), "AA22 expired or not due");
    }

    function test_theEntryPointRejectsAStalePeriod() public {
        PermissionId permissionId = _spendSession(100);
        handleOp(signUse(userOp(_transfer(10, T)), permissionId));

        vm.warp(T + DAY);
        _rejected(signUse(userOp(_transfer(10, T)), permissionId), "AA22 expired or not due");
    }

    function test_reEnablingTheSessionKeepsTheDaysUsage() public {
        Session memory session;
        {
            SpendPolicy.Limit[] memory limits = new SpendPolicy.Limit[](1);
            limits[0] = SpendPolicy.Limit(address(token), 100, DAY, true);
            session = _session()
                .withAction(address(token), bytes4(0xa9059cbb), address(allow), "")
                .withUserOpPolicy(address(spend), abi.encode(limits));
        }
        PermissionId permissionId = enableSession(session);
        handleOp(signUse(userOp(_transfer(100, T)), permissionId));

        vm.prank(address(account));
        smartSession.removeSession(permissionId);
        enableSession(session);

        ERC4337.PackedUserOperation memory op = signUse(userOp(_transfer(1, T)), permissionId);
        vm.expectPartialRevert(IEntryPoint.FailedOpWithRevert.selector);
        handleOp(op);
    }

    function test_aRateLimitCountsEveryOperation() public {
        PermissionId permissionId = enableSession(
            _session()
                .withAction(address(target), SET_VALUE, address(allow), "")
                .withUserOpPolicy(address(rateLimit), abi.encode(uint256(2), uint256(1 hours)))
        );
        handleOp(signUse(userOp(PolicyCalls.withTime(callSetValue(1), T)), permissionId));
        handleOp(signUse(userOp(PolicyCalls.withTime(callSetValue(2), T)), permissionId));
        ERC4337.PackedUserOperation memory third =
            signUse(userOp(PolicyCalls.withTime(callSetValue(3), T)), permissionId);
        vm.expectPartialRevert(IEntryPoint.FailedOpWithRevert.selector);
        handleOp(third);
        assertEq(target.value(), 2);
    }

    function test_smartSessionRefusesAllowPolicyAsAnErc1271Policy() public {
        vm.expectRevert(
            abi.encodeWithSelector(ISmartSession.UnsupportedPolicy.selector, address(allow))
        );
        enableSession(_session().withERC1271Policy(address(allow), ""));
    }
}
