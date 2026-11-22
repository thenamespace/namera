// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {IActionPolicy} from "./interfaces/IPolicy.sol";
import {Conditions} from "./lib/Conditions.sol";
import {PolicyBase, VALIDATION_FAILED, VALIDATION_SUCCESS} from "./lib/PolicyBase.sol";

/// @title ArgPolicy
/// @notice Conditions on a call's arguments and value: every rule must hold.
/// @dev `initData` is `abi.encode(Rule[])`. A rule compares one 32-byte word, read at `offset` bytes after the
/// selector (a static argument or a field of a static tuple), or the call's value when `offset` is `VALUE`, as an
/// unsigned integer: `Eq`, `Neq`, `Lt`, `Lte`, `Gt`, `Gte` against `refs[0]`, `Between` with
/// `refs[0] <= x <= refs[1]`, `OneOf` with `x` in `refs`. Calldata too short for a rule fails it. Dynamic arguments
/// (arrays, `bytes`, strings) and signed comparisons are not supported.
// slither-disable-next-line missing-inheritance
contract ArgPolicy is PolicyBase, IActionPolicy {
    struct Rule {
        Conditions.Condition condition;
        uint256 offset;
        bytes32[] refs;
    }

    /// @dev The `offset` that compares the call's value instead of an argument.
    uint256 public constant VALUE = type(uint256).max;

    error InvalidRule(uint256 index);

    function checkAction(bytes32 id, address account, address, uint256 value, bytes calldata data)
        external
        view
        returns (uint256)
    {
        Rule[] memory rules = abi.decode(_config(id, account), (Rule[]));
        uint256 length = rules.length;
        for (uint256 i; i < length; ++i) {
            Rule memory rule = rules[i];
            uint256 x;
            if (rule.offset == VALUE) {
                x = value;
            } else {
                uint256 start = 4 + rule.offset;
                if (data.length < start + 32) return VALIDATION_FAILED;
                x = uint256(bytes32(data[start:start + 32]));
            }
            if (!Conditions.holds(rule.condition, rule.refs, x)) return VALIDATION_FAILED;
        }
        return VALIDATION_SUCCESS;
    }

    function _supportsKind(bytes4 interfaceId) internal pure override returns (bool) {
        return interfaceId == type(IActionPolicy).interfaceId;
    }

    function _validateConfig(bytes calldata initData) internal pure override {
        Rule[] memory rules = abi.decode(initData, (Rule[]));
        uint256 length = rules.length;
        for (uint256 i; i < length; ++i) {
            if (!Conditions.wellFormed(rules[i].condition, rules[i].refs)) revert InvalidRule(i);
        }
    }
}
