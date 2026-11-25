// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {SpendPolicy} from "src/policies/SpendPolicy.sol";

import {SpendHandler} from "./handlers/SpendHandler.sol";

/// @notice Whatever time the agent states, and however often the session is re-enabled, the spending the
/// EntryPoint accepts in any real period stays within the budget.
contract SpendPolicyInvariants is Test {
    SpendHandler internal handler;

    function setUp() public {
        handler = new SpendHandler(new SpendPolicy());
        targetContract(address(handler));
    }

    function invariant_acceptedSpendingPerPeriodStaysWithinTheBudget() public view {
        uint256 count = handler.periodCount();
        for (uint256 i; i < count; ++i) {
            assertLe(handler.spentIn(handler.periods(i)), handler.BUDGET());
        }
    }

    /// @dev The run must exercise both outcomes, or the invariant would hold vacuously.
    function afterInvariant() public view {
        assertGt(handler.accepted(), 0);
        assertGt(handler.rejected(), 0);
    }
}
