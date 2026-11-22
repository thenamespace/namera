// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {ERC4337} from "solady/accounts/ERC4337.sol";

import {GasPolicy} from "src/policies/GasPolicy.sol";
import {RateLimitPolicy} from "src/policies/RateLimitPolicy.sol";
import {SpendPolicy} from "src/policies/SpendPolicy.sol";
import {ValuePolicy} from "src/policies/ValuePolicy.sol";
import {UserOpCalls} from "src/policies/lib/UserOpCalls.sol";

import {PolicyCalls} from "../../utils/PolicyCalls.sol";

abstract contract LimitPolicyTest is Test {
    address internal account = makeAddr("account");
    address internal token = makeAddr("token");
    address internal recipient = makeAddr("recipient");
    bytes32 internal constant ID = keccak256("config");
    uint256 internal constant DAY = 1 days;
    uint256 internal constant T = 20_000 * DAY + 100; // inside day 20 000

    function _op(bytes memory callData) internal view returns (ERC4337.PackedUserOperation memory) {
        return PolicyCalls.op(account, callData);
    }

    function _transferAt(uint256 amount, uint256 t)
        internal
        view
        returns (ERC4337.PackedUserOperation memory)
    {
        return _op(
            PolicyCalls.withTime(
                PolicyCalls.single(token, 0, PolicyCalls.transfer(recipient, amount)), t
            )
        );
    }

    function _bounds(uint256 period, uint256 t) internal pure returns (uint256) {
        uint256 start = (t / period) * period;
        return (start << 208) | ((start + period - 1) << 160);
    }
}

contract SpendPolicyTest is LimitPolicyTest {
    SpendPolicy internal policy = new SpendPolicy();

    function _limit(uint256 amount, uint256 period, bool countApprovals)
        internal
        view
        returns (SpendPolicy.Limit[] memory limits)
    {
        limits = new SpendPolicy.Limit[](1);
        limits[0] = SpendPolicy.Limit(token, amount, period, countApprovals);
    }

    function _configure(SpendPolicy.Limit[] memory limits) internal {
        policy.initializeWithMultiplexer(account, ID, abi.encode(limits));
    }

    function test_spendsUpToTheBudgetWithinAPeriodAndBoundsTheOperationToIt() public {
        _configure(_limit(100, DAY, true));
        assertEq(policy.checkUserOpPolicy(ID, _transferAt(60, T)), _bounds(DAY, T));
        assertEq(policy.checkUserOpPolicy(ID, _transferAt(40, T + 1000)), _bounds(DAY, T));
        assertEq(policy.checkUserOpPolicy(ID, _transferAt(1, T + 2000)), 1);
    }

    function test_startsAFreshBudgetExactlyAtThePeriodBoundary() public {
        _configure(_limit(100, DAY, true));
        uint256 lastSecond = (T / DAY + 1) * DAY - 1;
        policy.checkUserOpPolicy(ID, _transferAt(100, lastSecond));
        assertEq(policy.checkUserOpPolicy(ID, _transferAt(1, lastSecond)), 1);
        assertEq(
            policy.checkUserOpPolicy(ID, _transferAt(100, lastSecond + 1)),
            _bounds(DAY, lastSecond + 1)
        );
    }

    function test_aLifetimeBudgetNeverResetsAndNeedsNoTime() public {
        _configure(_limit(100, 0, true));
        bytes memory transfer100 =
            PolicyCalls.single(token, 0, PolicyCalls.transfer(recipient, 100));
        assertEq(policy.checkUserOpPolicy(ID, _op(transfer100)), 0);
        assertEq(policy.checkUserOpPolicy(ID, _transferAt(1, T + 365 days)), 1);
    }

    function test_aPeriodicSpendWithoutTheStatedTimeFails() public {
        _configure(_limit(100, DAY, true));
        assertEq(
            policy.checkUserOpPolicy(
                ID, _op(PolicyCalls.single(token, 0, PolicyCalls.transfer(recipient, 1)))
            ),
            1
        );
    }

    function test_callsThatSpendNothingNeedNoTimeAndGetNoBounds() public {
        _configure(_limit(100, DAY, true));
        assertEq(
            policy.checkUserOpPolicy(ID, _op(PolicyCalls.single(makeAddr("other"), 1 ether, ""))), 0
        );
    }

    function test_countsEveryCallOfABatchAndApprovalsUnlessAnApprovalPolicyGovernsThem() public {
        UserOpCalls.Call[] memory calls = new UserOpCalls.Call[](3);
        calls[0] = UserOpCalls.Call(token, 0, PolicyCalls.transfer(recipient, 30));
        calls[1] =
            UserOpCalls.Call(token, 0, abi.encodeWithSelector(0x23b872dd, account, recipient, 30));
        calls[2] = UserOpCalls.Call(token, 0, PolicyCalls.approve(recipient, 50));
        ERC4337.PackedUserOperation memory op =
            _op(PolicyCalls.withTime(PolicyCalls.batch(calls), T));

        _configure(_limit(100, DAY, true));
        assertEq(policy.checkUserOpPolicy(ID, op), 1);

        _configure(_limit(60, DAY, false));
        assertEq(policy.checkUserOpPolicy(ID, op), _bounds(DAY, T));
    }

    function test_reEnablingKeepsUsageAndANewScheduleStartsFresh() public {
        _configure(_limit(100, DAY, true));
        policy.checkUserOpPolicy(ID, _transferAt(100, T));

        _configure(_limit(100, DAY, true));
        assertEq(policy.checkUserOpPolicy(ID, _transferAt(1, T)), 1);
        _configure(_limit(150, DAY, true));
        assertEq(policy.checkUserOpPolicy(ID, _transferAt(50, T)), _bounds(DAY, T));

        _configure(_limit(100, 7 days, true));
        assertEq(policy.checkUserOpPolicy(ID, _transferAt(100, T)), _bounds(7 days, T));
    }

    function test_everyLimitOfATokenMustHaveRoomAndTheBoundsIntersect() public {
        SpendPolicy.Limit[] memory limits = new SpendPolicy.Limit[](2);
        limits[0] = SpendPolicy.Limit(token, 100, DAY, true);
        limits[1] = SpendPolicy.Limit(token, 150, 7 days, true);
        _configure(limits);
        assertEq(policy.checkUserOpPolicy(ID, _transferAt(100, T)), _bounds(DAY, T));
        uint256 nextDay = (T / DAY + 1) * DAY;
        assertEq(policy.checkUserOpPolicy(ID, _transferAt(60, nextDay)), 1);
    }

    function test_aTruncatedTransferCountsAsUnlimited() public {
        _configure(_limit(type(uint256).max - 1, 0, true));
        bytes memory truncated = abi.encodeWithSelector(0xa9059cbb, recipient);
        assertEq(policy.checkUserOpPolicy(ID, _op(PolicyCalls.single(token, 0, truncated))), 1);
    }

    function testFuzz_spendsInOnePeriodNeverExceedTheBudget(
        uint256 budget,
        uint256[8] memory amounts
    ) public {
        budget = bound(budget, 1, 1e30);
        _configure(_limit(budget, DAY, true));
        uint256 allowed;
        for (uint256 i; i < amounts.length; ++i) {
            uint256 amount = bound(amounts[i], 1, budget);
            if (policy.checkUserOpPolicy(ID, _transferAt(amount, T + i)) != 1) allowed += amount;
        }
        assertLe(allowed, budget);
    }
}

contract ValuePolicyTest is LimitPolicyTest {
    ValuePolicy internal policy = new ValuePolicy();

    function test_sumsValueAcrossTheBatchPerPeriod() public {
        policy.initializeWithMultiplexer(account, ID, abi.encode(uint256(1 ether), DAY));
        UserOpCalls.Call[] memory calls = new UserOpCalls.Call[](2);
        calls[0] = UserOpCalls.Call(recipient, 0.6 ether, "");
        calls[1] = UserOpCalls.Call(recipient, 0.4 ether, "");
        assertEq(
            policy.checkUserOpPolicy(ID, _op(PolicyCalls.withTime(PolicyCalls.batch(calls), T))),
            _bounds(DAY, T)
        );
        ERC4337.PackedUserOperation memory more =
            _op(PolicyCalls.withTime(PolicyCalls.single(recipient, 1, ""), T));
        assertEq(policy.checkUserOpPolicy(ID, more), 1);
        more = _op(PolicyCalls.withTime(PolicyCalls.single(recipient, 1 ether, ""), T + DAY));
        assertEq(policy.checkUserOpPolicy(ID, more), _bounds(DAY, T + DAY));
    }
}

contract RateLimitPolicyTest is LimitPolicyTest {
    RateLimitPolicy internal policy = new RateLimitPolicy();

    function test_countsOperationsPerPeriod() public {
        policy.initializeWithMultiplexer(account, ID, abi.encode(uint256(2), uint256(1 hours)));
        ERC4337.PackedUserOperation memory op =
            _op(PolicyCalls.withTime(PolicyCalls.single(recipient, 0, ""), T));
        assertEq(policy.checkUserOpPolicy(ID, op), _bounds(1 hours, T));
        assertEq(policy.checkUserOpPolicy(ID, op), _bounds(1 hours, T));
        assertEq(policy.checkUserOpPolicy(ID, op), 1);
        op = _op(PolicyCalls.withTime(PolicyCalls.single(recipient, 0, ""), T + 1 hours));
        assertEq(policy.checkUserOpPolicy(ID, op), _bounds(1 hours, T + 1 hours));
    }

    function test_periodicCountingNeedsTheStatedTime() public {
        policy.initializeWithMultiplexer(account, ID, abi.encode(uint256(2), uint256(1 hours)));
        assertEq(policy.checkUserOpPolicy(ID, _op(PolicyCalls.single(recipient, 0, ""))), 1);
    }
}

contract GasPolicyTest is LimitPolicyTest {
    GasPolicy internal policy = new GasPolicy();

    function test_countsTheWorstCaseCostIncludingThePaymastersGas() public {
        ERC4337.PackedUserOperation memory op =
            _op(PolicyCalls.withTime(PolicyCalls.single(recipient, 0, ""), T));
        // (2,000,000 + 1,000,000 + 100,000) gas at 1 gwei.
        assertEq(policy.cost(op), 3_100_000 gwei);
        op.paymasterAndData =
            abi.encodePacked(makeAddr("paymaster"), uint128(200_000), uint128(50_000), hex"aa");
        assertEq(policy.cost(op), 3_350_000 gwei);

        policy.initializeWithMultiplexer(account, ID, abi.encode(uint256(6_700_000 gwei), DAY));
        assertEq(policy.checkUserOpPolicy(ID, op), _bounds(DAY, T));
        assertEq(policy.checkUserOpPolicy(ID, op), _bounds(DAY, T));
        assertEq(policy.checkUserOpPolicy(ID, op), 1);
    }
}
