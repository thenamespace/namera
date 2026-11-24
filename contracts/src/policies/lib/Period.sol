// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

/// @notice Periods for limits without reading TIMESTAMP, which ERC-7562 bans during validation.
/// @dev The agent states the time `t` of its user operation (see `UserOpCalls.timestamp`). A limit charges the
/// period containing `t` and returns that period's bounds as validation data; the EntryPoint only accepts the
/// operation within the bounds, so `t` must truly be in the charged period. Several limits intersect their bounds,
/// and each still charges its own true period. Periods are aligned to the Unix epoch (a `86_400` period is a UTC
/// day); a period of 0 is the lifetime, which needs no time and never resets.
library Period {
    /// @dev ERC-4337 time bounds are 48 bits.
    uint256 internal constant MAX_TIME = type(uint48).max;
    /// @dev The latest time an agent may state: EntryPoint v0.9 reads bit 47 of both bounds as a block-number range.
    uint256 internal constant MAX_STATED_TIME = (1 << 47) - 1;

    /// @dev The index of the period of `length` seconds containing `t`; 0 for the lifetime.
    function index(uint256 length, uint256 t) internal pure returns (uint256) {
        return length == 0 ? 0 : t / length;
    }

    /// @dev ERC-4337 validation data that bounds an operation to the period of `length` containing `t`:
    /// `validAfter` is the period's first second and `validUntil` its last. 0 (no bounds) for the lifetime.
    function bounds(uint256 length, uint256 t) internal pure returns (uint256 validationData) {
        if (length == 0) return 0;
        // Rounds down to the period's first second.
        // forge-lint: disable-next-line(divide-before-multiply)
        uint256 validAfter = (t / length) * length;
        uint256 validUntil = validAfter + length - 1;
        if (validUntil > MAX_TIME) validUntil = MAX_TIME;
        return (validAfter << 208) | (validUntil << 160);
    }

    /// @dev The validation data valid in both `a` and `b`: the later `validAfter` and the earlier `validUntil`
    /// (a `validUntil` of 0 means no upper bound). Neither carries an aggregator.
    function intersect(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 afterA = a >> 208;
        uint256 afterB = b >> 208;
        uint256 untilA = (a >> 160) & MAX_TIME;
        uint256 untilB = (b >> 160) & MAX_TIME;
        if (untilA == 0) untilA = MAX_TIME;
        if (untilB == 0) untilB = MAX_TIME;
        uint256 validAfter = afterA > afterB ? afterA : afterB;
        uint256 validUntil = untilA < untilB ? untilA : untilB;
        return (validAfter << 208) | (validUntil == MAX_TIME ? 0 : validUntil << 160);
    }
}
