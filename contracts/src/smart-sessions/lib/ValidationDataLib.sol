// SPDX-License-Identifier: Apache-2.0
// Derived from erc7579/smartsessions@f5aaf86 (MIT; Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import {ValidationData} from "../DataTypes.sol";

/// @notice Intersection of ERC-4337 validation data from several policies.
library ValidationDataLib {
    /// @dev Returns the narrowest time window (latest `validAfter`, earliest non-zero `validUntil`). Returns 1
    /// (failed) if the aggregator fields differ and neither side is zero.
    function intersect(ValidationData a, ValidationData b)
        internal
        pure
        returns (ValidationData validationData)
    {
        assembly ("memory-safe") {
            // Valid when the aggregator fields are equal, or one side is entirely time bounds.
            let sum := shl(96, add(a, b))
            switch or(
                iszero(
                    and(
                        xor(a, b),
                        0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffff
                    )
                ),
                or(eq(sum, shl(96, a)), eq(sum, shl(96, b)))
            )
            case 1 {
                validationData := and(
                    or(a, b),
                    0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffff
                )
                // The later `validAfter`.
                let aTime :=
                    and(0xffffffffffff0000000000000000000000000000000000000000000000000000, a)
                let bTime :=
                    and(0xffffffffffff0000000000000000000000000000000000000000000000000000, b)
                validationData := or(
                    validationData,
                    xor(aTime, mul(xor(aTime, bTime), gt(bTime, aTime)))
                )
                // The earlier `validUntil`, zero read as unbounded.
                aTime := and(0x000000000000ffffffffffff0000000000000000000000000000000000000000, a)
                if iszero(aTime) {
                    aTime := 0x000000000000ffffffffffff0000000000000000000000000000000000000000
                }
                bTime := and(0x000000000000ffffffffffff0000000000000000000000000000000000000000, b)
                if iszero(bTime) {
                    bTime := 0x000000000000ffffffffffff0000000000000000000000000000000000000000
                }
                let until := xor(aTime, mul(xor(aTime, bTime), lt(bTime, aTime)))
                if iszero(until) {
                    until := 0x000000000000ffffffffffff0000000000000000000000000000000000000000
                }
                validationData := or(validationData, until)
            }
            default { validationData := 1 }
        }
    }
}
