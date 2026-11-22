// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {IPolicy} from "../interfaces/IPolicy.sol";
import {PolicyStorage} from "./PolicyStorage.sol";

/// @dev ERC-4337 validation data: valid without time bounds, and failed.
uint256 constant VALIDATION_SUCCESS = 0;
uint256 constant VALIDATION_FAILED = 1;

/// @notice What every Namera policy shares: its configuration storage, ERC-165 and the validation results.
/// @dev State is keyed by the multiplexer (`msg.sender`, Smart Sessions), the configuration id and the account,
/// so one deployment serves every account and session.
abstract contract PolicyBase is IPolicy {
    using PolicyStorage for PolicyStorage.Layout;

    PolicyStorage.Layout internal $;

    /// @dev The interface ids this policy implements besides IPolicy and ERC-165.
    function _supportsKind(bytes4 interfaceId) internal pure virtual returns (bool);

    /// @dev Checks `initData` and reverts if it cannot configure the policy.
    function _validateConfig(bytes calldata initData) internal pure virtual;

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IPolicy).interfaceId || interfaceId == 0x01ffc9a7
            || _supportsKind(interfaceId);
    }

    function initializeWithMultiplexer(address account, bytes32 configId, bytes calldata initData)
        external
    {
        _validateConfig(initData);
        $.write(PolicyStorage.configKey(configId, msg.sender), account, initData);
        emit PolicySet(configId, msg.sender, account);
    }

    /// @dev The configuration `msg.sender` set for `account` and `configId`; reverts if there is none.
    function _config(bytes32 configId, address account)
        internal
        view
        returns (bytes memory initData)
    {
        bool exists;
        (exists, initData) = $.read(PolicyStorage.configKey(configId, msg.sender), account);
        if (!exists) revert PolicyNotInitialized(configId, msg.sender, account);
    }

    /// @dev The counter `account` has used of `counter` (a key derived from the configuration and period).
    function _used(bytes32 counter, address account) internal view returns (uint256) {
        return $.counters[counter][account];
    }

    function _setUsed(bytes32 counter, address account, uint256 used) internal {
        $.counters[counter][account] = used;
    }
}
