// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {IUserOpPolicy} from "../interfaces/IPolicy.sol";
import {Period} from "./Period.sol";
import {PolicyBase, VALIDATION_FAILED} from "./PolicyBase.sol";
import {PolicyStorage} from "./PolicyStorage.sol";
import {UserOpCalls} from "./UserOpCalls.sol";

/// @notice A user operation policy that counts usage against budgets per period.
/// @dev Counters are keyed by the configuration, what is counted (`tag`, e.g. a token) and the period, never by the
/// budget: re-enabling a session, or changing only its budget, keeps the usage; a new schedule starts a new counter.
/// Usage in a period needs the agent's stated time (`UserOpCalls.timestamp`); an operation that uses nothing needs
/// none and gets no time bounds.
abstract contract LimitPolicy is PolicyBase, IUserOpPolicy {
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
        bytes32 counter =
            _counter(PolicyStorage.configKey(configId, msg.sender), tag, period, c.time);
        uint256 used = _used(counter, account);
        // Compared without adding, so an unlimited amount fails instead of overflowing, and a budget lowered below
        // the usage leaves no room.
        if (used > budget || amount > budget - used) {
            c.exceeded = true;
            return;
        }
        _setUsed(counter, account, used + amount);
        c.validationData = Period.intersect(c.validationData, Period.bounds(period, c.time));
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
        return _used(
            _counter(PolicyStorage.configKey(configId, multiplexer), tag, period, time), account
        );
    }

    /// @dev The counter of `tag` in the period of `period` seconds containing `time`.
    function _counter(bytes32 configKey, bytes32 tag, uint256 period, uint256 time)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(configKey, tag, period, Period.index(period, time)));
    }

    /// @dev The validation data of a finished charge.
    function _end(Charge memory c) internal pure returns (uint256) {
        return c.exceeded ? VALIDATION_FAILED : c.validationData;
    }

    function _supportsKind(bytes4 interfaceId) internal pure override returns (bool) {
        return interfaceId == type(IUserOpPolicy).interfaceId;
    }
}
