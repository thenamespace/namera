// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {Conditions} from "src/policies/lib/Conditions.sol";
import {Period} from "src/policies/lib/Period.sol";

/// @notice Halmos proofs (`check_` prefix) for intersecting period bounds and the argument comparisons. Run with
/// `pnpm symbolic`. The period arithmetic itself (`Period.bounds`, `Period.index`) divides by the period length,
/// which the solver cannot decide in reasonable time; `PeriodTest`'s fuzz tests and the spend invariants cover it.
contract PoliciesSymbolicTest is Test {
    uint256 internal constant MAX_TIME = type(uint48).max;

    /// @dev A `validUntil` of 0 and of `type(uint48).max` both mean no upper bound to the EntryPoint.
    function check_intersectNeverWidensTheWindow(uint48 a1, uint48 u1, uint48 a2, uint48 u2)
        public
        pure
    {
        uint256 vd = Period.intersect(_vd(a1, u1), _vd(a2, u2));
        uint256 validAfter = vd >> 208;
        uint256 validUntil = (vd >> 160) & MAX_TIME;
        if (validUntil == 0) validUntil = MAX_TIME;
        assertTrue(validAfter >= a1 && validAfter >= a2);
        if (u1 != 0) assertTrue(validUntil <= u1);
        if (u2 != 0) assertTrue(validUntil <= u2);
        assertEq(uint160(vd), 0);
    }

    function check_comparisonsMatchTheirOperators(uint8 raw, uint256 x, uint256 ref) public pure {
        vm.assume(raw <= uint8(Conditions.Condition.Gte));
        Conditions.Condition condition = Conditions.Condition(raw);
        bytes32[] memory refs = new bytes32[](1);
        refs[0] = bytes32(ref);
        bool holds = Conditions.holds(condition, refs, x);

        if (condition == Conditions.Condition.Eq) assertEq(holds, x == ref);
        if (condition == Conditions.Condition.Neq) assertEq(holds, x != ref);
        if (condition == Conditions.Condition.Lt) assertEq(holds, x < ref);
        if (condition == Conditions.Condition.Lte) assertEq(holds, x <= ref);
        if (condition == Conditions.Condition.Gt) assertEq(holds, x > ref);
        if (condition == Conditions.Condition.Gte) assertEq(holds, x >= ref);
    }

    function check_betweenIsInclusive(uint256 x, uint256 low, uint256 high) public pure {
        vm.assume(low <= high);
        bytes32[] memory refs = new bytes32[](2);
        refs[0] = bytes32(low);
        refs[1] = bytes32(high);
        assertEq(Conditions.holds(Conditions.Condition.Between, refs, x), low <= x && x <= high);
    }

    function _vd(uint48 validAfter, uint48 validUntil) private pure returns (uint256) {
        return (uint256(validAfter) << 208) | (uint256(validUntil) << 160);
    }
}
