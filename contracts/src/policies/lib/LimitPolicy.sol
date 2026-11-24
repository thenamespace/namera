// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {IUserOpPolicy} from "../interfaces/IPolicy.sol";
import {Period} from "./Period.sol";
import {PolicyBase, VALIDATION_FAILED} from "./PolicyBase.sol";
import {PolicyStorage} from "./PolicyStorage.sol";
import {UserOpCalls} from "./UserOpCalls.sol";

/// @notice A user operation policy that counts usage against budgets per period.
/// @dev Counters are keyed by the configuration, what is counted (`tag`, e.g. a token) and the period length, never
/// by the budget: re-enabling a session, or changing only its budget, keeps the usage; a new schedule starts a new
/// counter. A counter holds only its latest period, packed as `index ‖ used` (48 and 208 bits), so a new period
/// rewrites the slot instead of filling a fresh one (~17k gas less). Budgets are capped at 2^208 - 1. Usage in a
/// period needs the agent's stated time (`UserOpCalls.timestamp`); an operation that uses nothing needs none and gets
/// no time bounds.
abstract contract LimitPolicy is PolicyBase, IUserOpPolicy {
    /// @dev Counters and stored budgets keep a period (index or length) above a 208-bit amount.
    uint256 private constant AMOUNT_BITS = 208;
    uint256 private constant MAX_AMOUNT = (1 << AMOUNT_BITS) - 1;

    error InvalidLimit(uint256 index);

    struct Charge {
        bool hasTime;
        uint256 time;
        uint256 validationData;
        bool exceeded;
    }

    /// @dev Starts charging `userOp`: reads the agent's time once for every budget of the policy.
    function _begin(ERC4337.PackedUserOperation calldata userOp)
        internal
        pure
        returns (Charge memory c)
    {
        (c.hasTime, c.time) = UserOpCalls.timestamp(userOp.callData);
    }

    /// @dev Adds `amount` of `tag` to `account`'s usage in its period, failing the charge if that would exceed
    /// `budget` or if a periodic usage lacks the agent's time.
    function _charge(
        Charge memory c,
        bytes32 configId,
        address account,
        bytes32 tag,
        uint256 budget,
        uint256 period,
        uint256 amount
    ) internal {
        if (amount == 0 || c.exceeded) return;
        if (period != 0 && !c.hasTime) {
            c.exceeded = true;
            return;
        }
        bytes32 counter = _counter(PolicyStorage.configKey(configId, msg.sender), tag, period);
        uint256 index = Period.index(period, c.time);
        (uint256 latest, uint256 used) = _unpack(_counterOf(counter, account));
        // A later period already charged can't be the EntryPoint's present; it would reject the operation's bounds.
        if (latest > index) {
            c.exceeded = true;
            return;
        }
        if (latest < index) used = 0;
        // Compared without adding, so an unlimited amount fails instead of overflowing, and a budget lowered below
        // the usage leaves no room.
        if (used > budget || amount > budget - used) {
            c.exceeded = true;
            return;
        }
        uint256 bounds = Period.bounds(period, c.time);
        // A one-second period at time 0 is the only periodic charge without bounds (0 reads as "always valid").
        if (period != 0 && bounds == 0) {
            c.exceeded = true;
            return;
        }
        _setCounter(counter, account, (index << AMOUNT_BITS) | (used + amount));
        c.validationData = Period.intersect(c.validationData, bounds);
    }

    /// @notice What `account` has used of what `tag` counts (a token, or the policy's own tag) in the period of
    /// `period` seconds containing `time`, under the configuration `configId` that `multiplexer` set. Lets an agent
    /// check a budget before it sends.
    function usage(
        bytes32 configId,
        address multiplexer,
        address account,
        bytes32 tag,
        uint256 period,
        uint256 time
    ) external view returns (uint256) {
        bytes32 counter = _counter(PolicyStorage.configKey(configId, multiplexer), tag, period);
        (uint256 latest, uint256 used) = _unpack(_counterOf(counter, account));
        return latest == Period.index(period, time) ? used : 0;
    }

    /// @dev The counter of `tag` over periods of `period` seconds.
    function _counter(bytes32 configKey, bytes32 tag, uint256 period)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(configKey, tag, period));
    }

    /// @dev A counter's latest period index and the usage in it.
    function _unpack(uint256 word) private pure returns (uint256 index, uint256 used) {
        return (word >> AMOUNT_BITS, word & MAX_AMOUNT);
    }

    /// @dev A budget as stored: `period ‖ amount`, the amount capped at what a counter holds (no budget can allow
    /// more), the period at ERC-4337's 48-bit time. `index` names the budget in the revert.
    function _packBudget(uint256 amount, uint256 period, uint256 index)
        internal
        pure
        returns (uint256)
    {
        if (period > Period.MAX_TIME) revert InvalidLimit(index);
        return (period << AMOUNT_BITS) | (amount > MAX_AMOUNT ? MAX_AMOUNT : amount);
    }

    /// @dev A stored budget's amount and period.
    function _unpackBudget(uint256 word) internal pure returns (uint256 amount, uint256 period) {
        return (word & MAX_AMOUNT, word >> AMOUNT_BITS);
    }

    /// @dev The budget of a policy with one, stored by the default `_pack`.
    function _budget(bytes32 configId, address account)
        internal
        view
        returns (uint256 amount, uint256 period)
    {
        return _unpackBudget(_wordAt(_config(configId, account), 0));
    }

    /// @dev A policy with one budget: `initData` is `abi.encode(uint256 amount, uint256 period)`.
    function _pack(bytes calldata initData) internal pure virtual override returns (bytes memory) {
        (uint256 amount, uint256 period) = abi.decode(initData, (uint256, uint256));
        return abi.encode(_packBudget(amount, period, 0));
    }

    /// @dev The validation data of a finished charge.
    function _end(Charge memory c) internal pure returns (uint256) {
        return c.exceeded ? VALIDATION_FAILED : c.validationData;
    }

    function _supportsKind(bytes4 interfaceId) internal pure override returns (bool) {
        return interfaceId == type(IUserOpPolicy).interfaceId;
    }
}
