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
        assembly {
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
                // validAfter
                let a_vd :=
                    and(0xffffffffffff0000000000000000000000000000000000000000000000000000, a)
                let b_vd :=
                    and(0xffffffffffff0000000000000000000000000000000000000000000000000000, b)
                validationData := or(
                    validationData,
                    xor(a_vd, mul(xor(a_vd, b_vd), gt(b_vd, a_vd)))
                )
                // validUntil
                a_vd := and(0x000000000000ffffffffffff0000000000000000000000000000000000000000, a)
                if iszero(a_vd) {
                    a_vd := 0x000000000000ffffffffffff0000000000000000000000000000000000000000
                }
                b_vd := and(0x000000000000ffffffffffff0000000000000000000000000000000000000000, b)
                if iszero(b_vd) {
                    b_vd := 0x000000000000ffffffffffff0000000000000000000000000000000000000000
                }
                let until := xor(a_vd, mul(xor(a_vd, b_vd), lt(b_vd, a_vd)))
                if iszero(until) {
                    until := 0x000000000000ffffffffffff0000000000000000000000000000000000000000
                }
                validationData := or(validationData, until)
            }
            default { validationData := 1 }
        }
    }
}
