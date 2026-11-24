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
/// `refs[0] <= x <= refs[1]`, `OneOf` with `x` in `refs` (at most 65,535). Calldata too short for a rule fails it.
/// Offsets are below 2^232 - 1, besides `VALUE`. Dynamic arguments (arrays, `bytes`, strings) and signed comparisons
/// are not supported.
// slither-disable-next-line missing-inheritance
contract ArgPolicy is PolicyBase, IActionPolicy {
    struct Rule {
        Conditions.Condition condition;
        uint256 offset;
        bytes32[] refs;
    }

    /// @notice The `offset` that compares the call's value instead of an argument.
    uint256 public constant VALUE = type(uint256).max;

    /// @dev A stored rule is a word `condition (8) ‖ number of refs (16) ‖ offset (232)`, then its refs; the largest
    /// offset stands for `VALUE`.
    uint256 private constant OFFSET_BITS = 232;
    uint256 private constant MAX_OFFSET = (1 << OFFSET_BITS) - 1;

    error InvalidRule(uint256 index);

    /// @inheritdoc IActionPolicy
    function checkAction(bytes32 id, address account, address, uint256 value, bytes calldata data)
        external
        view
        returns (uint256)
    {
        bytes memory packed = _config(id, account);
        uint256 words = packed.length / 32;
        for (uint256 i = 0; i < words;) {
            uint256 head = _wordAt(packed, i);
            bytes32[] memory refs = new bytes32[]((head >> OFFSET_BITS) & type(uint16).max);
            for (uint256 j; j < refs.length; ++j) {
                refs[j] = bytes32(_wordAt(packed, i + 1 + j));
            }
            i += 1 + refs.length;

            uint256 offset = head & MAX_OFFSET;
            uint256 x;
            if (offset == MAX_OFFSET) {
                x = value;
            } else {
                uint256 start = 4 + offset;
                if (data.length < start + 32) return VALIDATION_FAILED;
                x = uint256(bytes32(data[start:start + 32]));
            }
            if (!Conditions.holds(Conditions.Condition(head >> 248), refs, x)) {
                return VALIDATION_FAILED;
            }
        }
        return VALIDATION_SUCCESS;
    }

    function _supportsKind(bytes4 interfaceId) internal pure override returns (bool) {
        return interfaceId == type(IActionPolicy).interfaceId;
    }

    function _pack(bytes calldata initData) internal pure override returns (bytes memory packed) {
        Rule[] memory rules = abi.decode(initData, (Rule[]));
        uint256 length = rules.length;
        uint256 words = 0;
        for (uint256 i; i < length; ++i) {
            words += 1 + rules[i].refs.length;
        }
        packed = new bytes(32 * words);
        uint256 w = 0;
        for (uint256 i; i < length; ++i) {
            Rule memory rule = rules[i];
            uint256 count = rule.refs.length;
            if (
                !Conditions.wellFormed(rule.condition, rule.refs) || count > type(uint16).max
                    || (rule.offset >= MAX_OFFSET && rule.offset != VALUE)
            ) revert InvalidRule(i);
            uint256 offset = rule.offset == VALUE ? MAX_OFFSET : rule.offset;
            _setWordAt(
                packed, w++, (uint256(rule.condition) << 248) | (count << OFFSET_BITS) | offset
            );
            for (uint256 j; j < count; ++j) {
                _setWordAt(packed, w++, uint256(rule.refs[j]));
            }
        }
    }
}
