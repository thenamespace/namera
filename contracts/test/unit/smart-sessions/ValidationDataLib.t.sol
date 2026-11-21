// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {ValidationData} from "src/smart-sessions/DataTypes.sol";
import {ValidationDataLib} from "src/smart-sessions/lib/ValidationDataLib.sol";

contract ValidationDataLibTest is Test {
    using ValidationDataLib for ValidationData;

    uint48 internal constant UNBOUNDED = type(uint48).max;

    function testFuzz_keepsLatestStartAndEarliestEnd(
        uint48 afterA,
        uint48 untilA,
        uint48 afterB,
        uint48 untilB
    ) public pure {
        vm.assume(untilA != 0 && untilB != 0);

        (uint48 validAfter, uint48 validUntil) =
            _unpack(_pack(afterA, untilA).intersect(_pack(afterB, untilB)));

        assertEq(validAfter, afterA > afterB ? afterA : afterB);
        assertEq(validUntil, untilA < untilB ? untilA : untilB);
    }

    function testFuzz_zeroUntil_meansUnbounded(uint48 validAfter, uint48 validUntil) public pure {
        vm.assume(validUntil != 0);

        (, uint48 until) = _unpack(_pack(validAfter, 0).intersect(_pack(0, validUntil)));

        assertEq(until, validUntil);
    }

    function test_twoUnboundedValues_giveMaximumUntil() public pure {
        (uint48 validAfter, uint48 validUntil) = _unpack(_pack(0, 0).intersect(_pack(0, 0)));

        assertEq(validAfter, 0);
        assertEq(validUntil, UNBOUNDED);
    }

    function testFuzz_differentAggregators_fail(address aggregatorA, address aggregatorB)
        public
        pure
    {
        vm.assume(aggregatorA != aggregatorB);
        vm.assume(aggregatorA != address(0) && aggregatorB != address(0));
        ValidationData a = ValidationData.wrap(uint160(aggregatorA));
        ValidationData b = ValidationData.wrap(uint160(aggregatorB));

        assertEq(ValidationData.unwrap(a.intersect(b)), 1);
    }

    function _pack(uint48 validAfter, uint48 validUntil) internal pure returns (ValidationData) {
        return ValidationData.wrap((uint256(validUntil) << 160) | (uint256(validAfter) << 208));
    }

    function _unpack(ValidationData data)
        internal
        pure
        returns (uint48 validAfter, uint48 validUntil)
    {
        uint256 raw = ValidationData.unwrap(data);
        validUntil = uint48(raw >> 160);
        validAfter = uint48(raw >> 208);
    }
}
