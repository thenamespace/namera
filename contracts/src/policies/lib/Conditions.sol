// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

/// @notice The comparisons `ArgPolicy` applies to one word, as unsigned integers.
library Conditions {
    enum Condition {
        Eq,
        Neq,
        Lt,
        Lte,
        Gt,
        Gte,
        Between,
        OneOf
    }

    /// @dev Whether `x` meets `condition` against `refs`: one reference for a comparison, `refs[0] <= x <= refs[1]`
    /// for `Between`, membership for `OneOf`.
    function holds(Condition condition, bytes32[] memory refs, uint256 x)
        internal
        pure
        returns (bool)
    {
        if (condition == Condition.OneOf) {
            uint256 length = refs.length;
            for (uint256 i; i < length; ++i) {
                if (uint256(refs[i]) == x) return true;
            }
            return false;
        }
        uint256 ref = uint256(refs[0]);
        if (condition == Condition.Eq) return x == ref;
        if (condition == Condition.Neq) return x != ref;
        if (condition == Condition.Lt) return x < ref;
        if (condition == Condition.Lte) return x <= ref;
        if (condition == Condition.Gt) return x > ref;
        if (condition == Condition.Gte) return x >= ref;
        return ref <= x && x <= uint256(refs[1]);
    }

    /// @dev Whether `refs` suit `condition`: one reference for a comparison, an ordered pair for `Between`, at
    /// least one for `OneOf`.
    function wellFormed(Condition condition, bytes32[] memory refs) internal pure returns (bool) {
        if (condition == Condition.Between) {
            return refs.length == 2 && uint256(refs[0]) <= uint256(refs[1]);
        }
        if (condition == Condition.OneOf) return refs.length > 0;
        return refs.length == 1;
    }
}
