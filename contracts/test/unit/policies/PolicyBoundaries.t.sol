// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {ERC4337} from "solady/accounts/ERC4337.sol";

import {AllowPolicy} from "src/policies/AllowPolicy.sol";
import {ApprovalPolicy} from "src/policies/ApprovalPolicy.sol";
import {ArgPolicy} from "src/policies/ArgPolicy.sol";
import {GasPolicy} from "src/policies/GasPolicy.sol";
import {RateLimitPolicy} from "src/policies/RateLimitPolicy.sol";
import {SignaturePolicy} from "src/policies/SignaturePolicy.sol";
import {SpendPolicy} from "src/policies/SpendPolicy.sol";
import {ValuePolicy} from "src/policies/ValuePolicy.sol";
import {
    I1271Policy,
    IActionPolicy,
    IPolicy,
    IUserOpPolicy
} from "src/policies/interfaces/IPolicy.sol";
import {Conditions} from "src/policies/lib/Conditions.sol";
import {LimitPolicy} from "src/policies/lib/LimitPolicy.sol";
import {Period} from "src/policies/lib/Period.sol";
import {UserOpCalls} from "src/policies/lib/UserOpCalls.sol";

import {PolicyCalls} from "../../utils/PolicyCalls.sol";
import {CallsHarness} from "./PolicyLibs.t.sol";

/// @notice Each policy reports exactly its own kinds through ERC-165.
contract PolicyInterfaceSupportTest is Test {
    bytes4[] internal kinds;

    function setUp() public {
        kinds.push(type(IUserOpPolicy).interfaceId);
        kinds.push(type(IActionPolicy).interfaceId);
        kinds.push(type(I1271Policy).interfaceId);
    }

    function _expect(IPolicy policy, bool userOp, bool action, bool erc1271) internal view {
        assertTrue(policy.supportsInterface(type(IPolicy).interfaceId));
        assertTrue(policy.supportsInterface(0x01ffc9a7));
        assertEq(policy.supportsInterface(kinds[0]), userOp);
        assertEq(policy.supportsInterface(kinds[1]), action);
        assertEq(policy.supportsInterface(kinds[2]), erc1271);
        assertFalse(policy.supportsInterface(0x00000000));
        assertFalse(policy.supportsInterface(0x00000001));
        assertFalse(policy.supportsInterface(0xffffffff));
        for (uint256 i; i < kinds.length; ++i) {
            assertFalse(policy.supportsInterface(bytes4(uint32(kinds[i]) - 1)));
            assertFalse(policy.supportsInterface(bytes4(uint32(kinds[i]) + 1)));
        }
    }

    function test_eachPolicyReportsItsKinds() public {
        _expect(new AllowPolicy(), true, true, false);
        _expect(new ArgPolicy(), false, true, false);
        _expect(new ApprovalPolicy(), false, true, false);
        _expect(new SpendPolicy(), true, false, false);
        _expect(new ValuePolicy(), true, false, false);
        _expect(new RateLimitPolicy(), true, false, false);
        _expect(new GasPolicy(), true, false, false);
        _expect(new SignaturePolicy(), false, false, true);
    }
}

/// @notice Malformed configurations revert at enable time instead of failing every later check.
contract PolicyConfigTest is Test {
    address internal account = makeAddr("account");

    function test_rejectsMalformedConfigurations() public {
        IPolicy[6] memory policies = [
            IPolicy(new ApprovalPolicy()),
            IPolicy(new SpendPolicy()),
            IPolicy(new ValuePolicy()),
            IPolicy(new RateLimitPolicy()),
            IPolicy(new GasPolicy()),
            IPolicy(new SignaturePolicy())
        ];
        for (uint256 i; i < policies.length; ++i) {
            vm.expectRevert();
            policies[i].initializeWithMultiplexer(account, bytes32(i), hex"0102");
        }
    }

    function test_rejectsALimitWithoutAToken() public {
        SpendPolicy policy = new SpendPolicy();
        SpendPolicy.Limit[] memory limits = new SpendPolicy.Limit[](2);
        limits[0] = SpendPolicy.Limit(makeAddr("token"), 1, 0, true);
        limits[1] = SpendPolicy.Limit(address(0), 1, 0, true);
        vm.expectRevert(abi.encodeWithSelector(LimitPolicy.InvalidLimit.selector, 1));
        policy.initializeWithMultiplexer(account, "id", abi.encode(limits));
    }

    /// @dev Stored budgets hold the period in ERC-4337's 48 bits of time.
    function test_rejectsAPeriodPast48Bits() public {
        SpendPolicy spend = new SpendPolicy();
        SpendPolicy.Limit[] memory limits = new SpendPolicy.Limit[](1);
        limits[0] = SpendPolicy.Limit(makeAddr("token"), 1, uint256(type(uint48).max) + 1, true);
        vm.expectRevert(abi.encodeWithSelector(LimitPolicy.InvalidLimit.selector, 0));
        spend.initializeWithMultiplexer(account, "id", abi.encode(limits));

        ValuePolicy value = new ValuePolicy();
        vm.expectRevert(abi.encodeWithSelector(LimitPolicy.InvalidLimit.selector, 0));
        value.initializeWithMultiplexer(account, "id", abi.encode(1, uint256(type(uint48).max) + 1));
        value.initializeWithMultiplexer(account, "id", abi.encode(1, type(uint48).max));
    }

    function test_allowPolicyChecksItsConfigurationForUserOperations() public {
        AllowPolicy policy = new AllowPolicy();
        vm.expectRevert(
            abi.encodeWithSelector(
                IPolicy.PolicyNotInitialized.selector, bytes32("id"), address(this), account
            )
        );
        policy.checkUserOpPolicy("id", PolicyCalls.op(account, ""));
    }
}

contract ConditionsBoundaryTest is Test {
    ArgPolicy internal policy = new ArgPolicy();
    address internal account = makeAddr("account");

    function _rule(Conditions.Condition condition, uint256 offset, bytes32[] memory refs)
        internal
        pure
        returns (ArgPolicy.Rule[] memory rules)
    {
        rules = new ArgPolicy.Rule[](1);
        rules[0] = ArgPolicy.Rule(condition, offset, refs);
    }

    function _refs(uint256 a, uint256 b) internal pure returns (bytes32[] memory refs) {
        refs = new bytes32[](2);
        refs[0] = bytes32(a);
        refs[1] = bytes32(b);
    }

    function _word(uint256 x) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(0x12345678, x);
    }

    /// @dev Stored rules hold the offset in 232 bits, the largest standing for `VALUE`.
    function test_rejectsAnOffsetPast232BitsOtherThanTheValue() public {
        bytes32[] memory refs = new bytes32[](1);
        uint256 largest = (1 << 232) - 1;
        vm.expectRevert(abi.encodeWithSelector(ArgPolicy.InvalidRule.selector, 0));
        policy.initializeWithMultiplexer(
            account, "id", abi.encode(_rule(Conditions.Condition.Eq, largest, refs))
        );

        policy.initializeWithMultiplexer(
            account, "id", abi.encode(_rule(Conditions.Condition.Eq, largest - 1, refs))
        );
        assertEq(policy.checkAction("id", account, address(0), 0, _word(0)), 1);
        policy.initializeWithMultiplexer(
            account, "id", abi.encode(_rule(Conditions.Condition.Eq, policy.VALUE(), refs))
        );
        assertEq(policy.checkAction("id", account, address(0), 0, _word(1)), 0);
        assertEq(policy.checkAction("id", account, address(0), 1, _word(0)), 1);
    }

    function test_oneOfMatchesOnlyItsMembers() public {
        policy.initializeWithMultiplexer(
            account, "id", abi.encode(_rule(Conditions.Condition.OneOf, 0, _refs(1, 5)))
        );
        assertEq(policy.checkAction("id", account, address(0), 0, _word(5)), 0);
        assertEq(policy.checkAction("id", account, address(0), 0, _word(3)), 1);
        assertEq(policy.checkAction("id", account, address(0), 0, _word(0)), 1);
    }

    function test_betweenAcceptsAOneValueRangeAndNeedsExactlyTwoReferences() public {
        policy.initializeWithMultiplexer(
            account, "id", abi.encode(_rule(Conditions.Condition.Between, 0, _refs(7, 7)))
        );
        assertEq(policy.checkAction("id", account, address(0), 0, _word(7)), 0);

        bytes32[] memory one = new bytes32[](1);
        vm.expectRevert(abi.encodeWithSelector(ArgPolicy.InvalidRule.selector, 0));
        policy.initializeWithMultiplexer(
            account, "id", abi.encode(_rule(Conditions.Condition.Between, 0, one))
        );

        bytes32[] memory three = new bytes32[](3);
        three[0] = bytes32(uint256(2));
        three[1] = bytes32(uint256(1));
        vm.expectRevert(abi.encodeWithSelector(ArgPolicy.InvalidRule.selector, 0));
        policy.initializeWithMultiplexer(
            account, "id", abi.encode(_rule(Conditions.Condition.Between, 0, three))
        );
    }

    function test_oneOfTakesAnyNonEmptyListAndBetweenExactlyAnOrderedPair() public {
        bytes32[] memory single = new bytes32[](1);
        single[0] = bytes32(uint256(9));
        policy.initializeWithMultiplexer(
            account, "id", abi.encode(_rule(Conditions.Condition.OneOf, 0, single))
        );
        assertEq(policy.checkAction("id", account, address(0), 0, _word(9)), 0);

        bytes32[] memory ordered = new bytes32[](3);
        ordered[0] = bytes32(uint256(1));
        ordered[1] = bytes32(uint256(2));
        ordered[2] = bytes32(uint256(3));
        policy.initializeWithMultiplexer(
            account, "id", abi.encode(_rule(Conditions.Condition.OneOf, 0, ordered))
        );
        vm.expectRevert(abi.encodeWithSelector(ArgPolicy.InvalidRule.selector, 0));
        policy.initializeWithMultiplexer(
            account, "id", abi.encode(_rule(Conditions.Condition.Between, 0, ordered))
        );
    }

    function test_aComparisonTakesExactlyOneReference() public {
        vm.expectRevert(abi.encodeWithSelector(ArgPolicy.InvalidRule.selector, 0));
        policy.initializeWithMultiplexer(
            account, "id", abi.encode(_rule(Conditions.Condition.Eq, 0, _refs(1, 2)))
        );
    }

    function test_readsAWordAtAnyOffset() public {
        bytes32[] memory ref = new bytes32[](1);
        ref[0] = bytes32(uint256(0xabcd) << 32);
        policy.initializeWithMultiplexer(
            account, "id", abi.encode(_rule(Conditions.Condition.Eq, 4, ref))
        );
        // The word 4 bytes into the arguments: the low bytes of the first word and the high bytes of the second.
        bytes memory data = abi.encodePacked(bytes4(0x12345678), uint256(0xabcd), uint256(0));
        assertEq(policy.checkAction("id", account, address(0), 0, data), 0);
        assertEq(policy.checkAction("id", account, address(0), 0, _word(0xabcd)), 1);
    }
}

contract ApprovalBoundaryTest is Test {
    ApprovalPolicy internal policy = new ApprovalPolicy();
    address internal account = makeAddr("account");
    address internal spender = address(0x2000);
    address internal high = address(0x3000);
    address internal token = address(0x4000);

    function setUp() public {
        address[] memory spenders = new address[](1);
        spenders[0] = spender;
        ApprovalPolicy.Cap[] memory caps = new ApprovalPolicy.Cap[](1);
        caps[0] = ApprovalPolicy.Cap(token, 100);
        policy.initializeWithMultiplexer(account, "id", abi.encode(spenders, caps));
    }

    function _check(bytes memory data) internal view returns (uint256) {
        return policy.checkAction("id", account, token, 0, data);
    }

    function test_acceptsTrailingCalldataAndRejectsOtherSelectorsAroundTheApprovalOnes()
        public
        view
    {
        address permit2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
        assertEq(_check(abi.encodePacked(PolicyCalls.approve(spender, 50), uint256(1))), 0);
        bytes memory permit =
            abi.encodeWithSelector(0x87517c45, token, spender, uint160(50), uint48(1));
        assertEq(
            policy.checkAction("id", account, permit2, 0, abi.encodePacked(permit, uint256(1))), 0
        );
        assertEq(_check(abi.encodeWithSelector(0x00000001, spender, 50)), 1);
        assertEq(_check(abi.encodeWithSelector(0xfffffffe, spender, 50)), 1);
        assertEq(
            policy.checkAction(
                "id",
                account,
                permit2,
                0,
                abi.encodeWithSelector(0x87517c44, token, spender, uint160(50), uint48(1))
            ),
            1
        );
        assertEq(
            policy.checkAction(
                "id",
                account,
                permit2,
                0,
                abi.encodeWithSelector(0x87517c46, token, spender, uint160(50), uint48(1))
            ),
            1
        );
    }

    function test_revokesThroughPermit2OnlyForAListedToken() public view {
        address permit2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
        assertEq(
            policy.checkAction(
                "id",
                account,
                permit2,
                0,
                abi.encodeWithSelector(0x87517c45, token, high, uint160(0), uint48(1))
            ),
            0
        );
        assertEq(
            policy.checkAction(
                "id",
                account,
                permit2,
                0,
                abi.encodeWithSelector(0x87517c45, address(1), high, uint160(0), uint48(1))
            ),
            1
        );
    }
}

contract SpendBoundaryTest is Test {
    SpendPolicy internal policy = new SpendPolicy();
    address internal account = makeAddr("account");
    address internal token = address(0x5000);

    function _configure(uint256 amount, uint256 period, bool countApprovals) internal {
        SpendPolicy.Limit[] memory limits = new SpendPolicy.Limit[](1);
        limits[0] = SpendPolicy.Limit(token, amount, period, countApprovals);
        policy.initializeWithMultiplexer(account, "id", abi.encode(limits));
    }

    function _check(address target, bytes memory data) internal returns (uint256) {
        return policy.checkUserOpPolicy(
            "id", PolicyCalls.op(account, PolicyCalls.single(target, 0, data))
        );
    }

    function test_countsApprovalsAndAllowanceIncreasesByTheirAmount() public {
        _configure(50, 0, true);
        assertEq(_check(token, PolicyCalls.approve(address(1), 30)), 0);
        assertEq(_check(token, abi.encodeWithSelector(0x39509351, address(1), 20)), 0);
        assertEq(_check(token, abi.encodeWithSelector(0x39509351, address(1), 1)), 1);
    }

    /// @dev Regression (internal review, finding 5): a function of a limited token the policy can't measure counts as
    /// unlimited, so it can't move tokens past the budget (`transferAndCall`, `push`, share transfers).
    function test_countsOtherFunctionsOfTheTokenAsUnlimited() public {
        _configure(1000, 0, true);
        bytes4[4] memory others = [bytes4(0x00000001), 0x095ea7b2, 0x39509352, 0xffffffff];
        for (uint256 i; i < others.length; ++i) {
            assertEq(_check(token, abi.encodeWithSelector(others[i], address(1), 5)), 1);
        }
        assertEq(_check(token, hex"0102"), 1);
        // Plain value to the token moves none of it.
        assertEq(_check(token, ""), 0);
    }

    /// @dev Regression (internal review, finding 4): Permit2's `approve` of a limited token is spending, unless an
    /// approvals policy governs the token's approvals.
    function test_countsPermit2ApprovalsOfTheToken() public {
        address permit2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
        bytes memory approve40 =
            abi.encodeWithSelector(0x87517c45, token, address(1), uint160(40), uint48(1));
        _configure(50, 0, true);
        assertEq(_check(permit2, approve40), 0);
        assertEq(_check(permit2, approve40), 1);
        assertEq(
            _check(
                permit2,
                abi.encodeWithSelector(0x87517c45, address(2), address(1), uint160(99), uint48(1))
            ),
            0
        );
        assertEq(_check(permit2, abi.encodeWithSelector(0x87517c45, token)), 1);

        _configure(1, 0, false);
        assertEq(_check(permit2, approve40), 0);
    }

    function test_ignoresOtherTargetsAndGovernedApprovals() public {
        _configure(1, 0, false);
        assertEq(_check(address(0x4fff), PolicyCalls.transfer(address(1), 5)), 0);
        assertEq(_check(address(0x5001), PolicyCalls.transfer(address(1), 5)), 0);
        assertEq(_check(token, PolicyCalls.approve(address(1), 5)), 0);
        assertEq(_check(token, abi.encodeWithSelector(0x39509351, address(1), 5)), 0);
    }

    function test_countsTransfersWithTrailingCalldataAndASelectorAloneAsUnlimited() public {
        _configure(10, 0, true);
        assertEq(
            _check(token, abi.encodePacked(PolicyCalls.transfer(address(1), 10), uint256(99))), 0
        );
        assertEq(_check(token, hex"a9059cbb"), 1);
    }

    function test_aBudgetLoweredBelowTheUsageLeavesNoRoom() public {
        _configure(10, 0, true);
        _check(token, PolicyCalls.transfer(address(1), 10));
        _configure(5, 0, true);
        assertEq(_check(token, PolicyCalls.transfer(address(1), 1)), 1);
    }

    function test_aLifetimeLimitIgnoresAStatedTime() public {
        _configure(10, 0, true);
        bytes memory callData = PolicyCalls.withTime(
            PolicyCalls.single(token, 0, PolicyCalls.transfer(address(1), 10)), 1
        );
        assertEq(policy.checkUserOpPolicy("id", PolicyCalls.op(account, callData)), 0);
    }
}

contract LimitBoundaryTest is Test {
    function test_gasCountsAPaymasterWithoutData() public {
        GasPolicy policy = new GasPolicy();
        ERC4337.PackedUserOperation memory op = PolicyCalls.op(address(this), "");
        op.paymasterAndData = abi.encodePacked(address(0xbeef), uint128(200_000), uint128(50_000));
        assertEq(policy.cost(op), 3_350_000 gwei);
        op.paymasterAndData = abi.encodePacked(address(0xbeef), uint128(200_000), uint120(50_000));
        assertEq(policy.cost(op), 3_100_000 gwei);
    }

    function test_boundsNearTheEndOfTimeStayWithin48Bits() public pure {
        uint256 t = type(uint48).max - 10;
        uint256 vd = Period.bounds(1 days, t);
        assertEq((vd >> 160) & type(uint48).max, type(uint48).max);
        assertEq(vd >> 208, (t / 1 days) * 1 days);
    }
}

contract UserOpCallsBoundaryTest is Test {
    CallsHarness internal harness = new CallsHarness();

    /// @dev `execute` with its `bytes` argument at a non-standard offset, as the ABI decoder still accepts.
    function _executeAt(uint256 offset, bytes memory executionCalldata)
        internal
        pure
        returns (bytes memory)
    {
        bytes memory head = abi.encodePacked(bytes4(0xe9ae5c53), bytes32(0), offset);
        bytes memory padding = new bytes(offset - 0x40);
        bytes memory tail = new bytes((32 - executionCalldata.length % 32) % 32);
        return abi.encodePacked(head, padding, executionCalldata.length, executionCalldata, tail);
    }

    function test_followsTheArgumentOffsetAsTheAbiDecoderDoes() public view {
        bytes memory execution = abi.encodePacked(address(7), uint256(5), hex"abcd");
        for (uint256 offset = 0x44; offset <= 0x64; offset += 0x20) {
            UserOpCalls.Call[] memory calls =
                harness.decode(_executeAt(offset, execution), address(1));
            assertEq(calls[0].target, address(7));
            assertEq(calls[0].value, 5);
        }
        bytes memory callData =
            _executeAt(0x64, abi.encodePacked(address(7), uint256(0), bytes30(0)));
        (bool found, uint256 t) = harness.timestamp(abi.encodePacked(callData, uint256(42)));
        assertTrue(found);
        assertEq(t, 42);
    }

    function test_onlyTheExecuteSelectorIsAnExecution() public view {
        // mode ‖ offset ‖ length 0: as an `execute`, this would be a complete empty single call.
        bytes memory body = abi.encodePacked(bytes32(0), uint256(0x40), uint256(0));
        UserOpCalls.Call[] memory above =
            harness.decode(abi.encodePacked(bytes4(0xe9ae5c54), body), address(1));
        UserOpCalls.Call[] memory below =
            harness.decode(abi.encodePacked(bytes4(0xe9ae5c52), body), address(1));
        assertEq(above[0].target, address(1));
        assertEq(below[0].target, address(1));
        (bool found,) = harness.timestamp(abi.encodePacked(bytes4(0xe9ae5c54), body, uint256(1)));
        assertFalse(found);
        (found,) = harness.timestamp(abi.encodePacked(bytes4(0xe9ae5c52), body, uint256(1)));
        assertFalse(found);
        (found,) = harness.timestamp(abi.encodePacked(bytes4(0xe9ae5c53), body, uint256(1)));
        assertTrue(found);
    }

    /// @dev Kernel with SessionHook wraps every session operation in `executeUserOp`; the policies read the wrapped
    /// `execute`, or a budget could be bypassed by wrapping.
    function test_readsTheExecuteWrappedInExecuteUserOp() public view {
        bytes memory execute =
            PolicyCalls.withTime(PolicyCalls.single(address(7), 5, hex"abcd"), 42);
        bytes memory wrapped = abi.encodePacked(bytes4(0x8dd7712f), execute);

        UserOpCalls.Call[] memory calls = harness.decode(wrapped, address(1));
        assertEq(calls.length, 1);
        assertEq(calls[0].target, address(7));
        assertEq(calls[0].value, 5);
        (bool found, uint256 t) = harness.timestamp(wrapped);
        assertTrue(found);
        assertEq(t, 42);
        // `executeUserOp` alone is not an execution: a call to the account with nothing left.
        UserOpCalls.Call[] memory alone = harness.decode(hex"8dd7712f", address(1));
        assertEq(alone[0].target, address(1));
        assertEq(alone[0].data, "");
        // Calldata too short for a selector is a call to the account.
        assertEq(harness.decode(hex"01", address(1))[0].data, hex"01");

        // Only `executeUserOp` is unwrapped: a selector on either side is a call to the account.
        bytes4[2] memory others = [bytes4(0x8dd7712e), bytes4(0x8dd77130)];
        for (uint256 i; i < others.length; ++i) {
            bytes memory other = abi.encodePacked(others[i], execute);
            assertEq(harness.decode(other, address(1))[0].target, address(1));
            (found,) = harness.timestamp(other);
            assertFalse(found);
        }
    }

    function test_calldataTooShortForAnExecuteStatesNoTime() public view {
        bytes[3] memory short =
            [bytes(""), bytes(hex"e9ae5c53"), abi.encodePacked(bytes4(0xe9ae5c53), bytes32(0))];
        for (uint256 i; i < short.length; ++i) {
            (bool found,) = harness.timestamp(short[i]);
            assertFalse(found);
        }
    }

    /// @dev SessionHook's tag follows the stated time: `… ‖ time ‖ permissionId ‖ tag`.
    function test_findsTheStatedTimeBeforeSessionHooksTag() public view {
        bytes memory execute = PolicyCalls.withTime(PolicyCalls.single(address(7), 0, ""), 42);
        bytes32 tag = keccak256("namera.session-hook.tag");
        (bool found, uint256 t) =
            harness.timestamp(abi.encodePacked(execute, keccak256("permission"), tag));
        assertTrue(found);
        assertEq(t, 42);
        (found, t) = harness.timestamp(
            abi.encodePacked(bytes4(0x8dd7712f), execute, keccak256("permission"), tag)
        );
        assertTrue(found);
        assertEq(t, 42);

        // Two words after the time that are not the tag: no stated time.
        (found,) = harness.timestamp(
            abi.encodePacked(execute, keccak256("permission"), keccak256("other"))
        );
        assertFalse(found);
        // A tag without the time before it.
        (found,) = harness.timestamp(
            abi.encodePacked(PolicyCalls.single(address(7), 0, ""), keccak256("p"), tag)
        );
        assertFalse(found);
    }

    function test_theStatedTimeMayBeTheLast48BitSecond() public view {
        bytes memory callData =
            PolicyCalls.withTime(PolicyCalls.single(address(7), 0, ""), type(uint48).max);
        (bool found, uint256 t) = harness.timestamp(callData);
        assertTrue(found);
        assertEq(t, type(uint48).max);
    }

    function test_aBareExecuteSelectorIsNotACallToTheAccount() public {
        vm.expectRevert();
        harness.decode(hex"e9ae5c53", address(1));
    }
}
