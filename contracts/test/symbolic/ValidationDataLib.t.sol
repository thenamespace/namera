// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {ValidationData} from "src/smart-sessions/DataTypes.sol";
import {ValidationDataLib} from "src/smart-sessions/lib/ValidationDataLib.sol";

/// @notice Halmos proofs (`check_` prefix) for intersecting policy results. Run with `pnpm symbolic`.
contract ValidationDataLibSymbolicTest is Test {
    using ValidationDataLib for ValidationData;

    function check_isCommutative(uint256 a, uint256 b) public pure {
        ValidationData x = ValidationData.wrap(a);
        ValidationData y = ValidationData.wrap(b);

        assertEq(ValidationData.unwrap(x.intersect(y)), ValidationData.unwrap(y.intersect(x)));
    }

    /// @dev A failed result (sigFailed / aggregator 1) can never be turned into a success.
    function check_failureIsNeverCleared(uint256 other) public pure {
        ValidationData failed = ValidationData.wrap(1);

        uint256 result = ValidationData.unwrap(failed.intersect(ValidationData.wrap(other)));

        assertTrue(uint160(result) != 0);
    }

    function check_windowNeverWidens(uint48 afterA, uint48 untilA, uint48 afterB, uint48 untilB)
        public
        pure
    {
        uint256 result =
            ValidationData.unwrap(_pack(afterA, untilA).intersect(_pack(afterB, untilB)));
        uint48 validAfter = uint48(result >> 208);
        uint48 validUntil = uint48(result >> 160);

        assertTrue(validAfter >= afterA && validAfter >= afterB);
        if (untilA != 0) assertTrue(validUntil <= untilA);
        if (untilB != 0) assertTrue(validUntil <= untilB);
        assertEq(uint160(result), 0);
    }

    function _pack(uint48 validAfter, uint48 validUntil) internal pure returns (ValidationData) {
        return ValidationData.wrap((uint256(validUntil) << 160) | (uint256(validAfter) << 208));
    }
}
