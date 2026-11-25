// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {CommonBase} from "forge-std/Base.sol";
import {StdUtils} from "forge-std/StdUtils.sol";

import {SpendPolicy} from "src/policies/SpendPolicy.sol";

import {PolicyCalls} from "../../utils/PolicyCalls.sol";

/// @notice Drives a SpendPolicy as its multiplexer would, with an agent free to state any time. An operation only
/// counts if the EntryPoint would accept it: the real time must lie in the bounds the policy returned.
contract SpendHandler is CommonBase, StdUtils {
    uint256 public constant BUDGET = 1000;
    uint256 public constant PERIOD = 1 days;
    bytes32 internal constant ID = keccak256("invariant");

    SpendPolicy public immutable policy;
    address public immutable account = address(0xA11CE);
    address public immutable token = address(0x70CE);

    uint256 public now_ = 20_000 days;
    /// @dev Accepted spending per real period.
    mapping(uint256 period => uint256 spent) public spentIn;
    uint256[] public periods;
    uint256 public accepted;
    uint256 public rejected;

    constructor(SpendPolicy policy_) {
        policy = policy_;
        _configure();
    }

    function spend(uint256 amount, int256 skew) external {
        amount = bound(amount, 1, BUDGET);
        // The agent may claim a time in the past, the present or the future.
        int256 offset = bound(skew, -3 * int256(PERIOD), 3 * int256(PERIOD));
        uint256 stated = uint256(int256(now_) + offset);

        bytes memory callData = PolicyCalls.withTime(
            PolicyCalls.single(token, 0, PolicyCalls.transfer(address(1), amount)), stated
        );
        uint256 snapshot = vm.snapshotState();
        uint256 vd = policy.checkUserOpPolicy(ID, PolicyCalls.op(account, callData));

        uint256 validAfter = vd >> 208;
        uint256 validUntil = (vd >> 160) & type(uint48).max;
        bool ok = vd != 1 && validAfter <= now_ && now_ <= validUntil;
        if (!ok) {
            // The EntryPoint rejects the operation, so the policy's writes revert with it.
            vm.revertToState(snapshot);
            ++rejected;
            return;
        }
        uint256 period = now_ / PERIOD;
        if (spentIn[period] == 0) periods.push(period);
        spentIn[period] += amount;
        ++accepted;
    }

    function advance(uint256 seconds_) external {
        now_ += bound(seconds_, 1, 2 * PERIOD);
    }

    /// @dev The owner re-enables the same session.
    function reEnable() external {
        _configure();
    }

    function periodCount() external view returns (uint256) {
        return periods.length;
    }

    function _configure() internal {
        SpendPolicy.Limit[] memory limits = new SpendPolicy.Limit[](1);
        limits[0] = SpendPolicy.Limit(token, BUDGET, PERIOD, true);
        policy.initializeWithMultiplexer(account, ID, abi.encode(limits));
    }
}
