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

    /// @dev What the policy stores of `initData`, its ABI configuration: a packed form its checks read back with
    /// fewer storage reads (each word read costs 2,100 gas cold). Reverts if `initData` cannot configure the policy.
    function _pack(bytes calldata initData) internal pure virtual returns (bytes memory);

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IPolicy).interfaceId || interfaceId == 0x01ffc9a7
            || _supportsKind(interfaceId);
    }

    function initializeWithMultiplexer(address account, bytes32 configId, bytes calldata initData)
        external
    {
        $.write(PolicyStorage.configKey(configId, msg.sender), account, _pack(initData));
        emit PolicySet(configId, msg.sender, account);
    }

    /// @dev The packed configuration `msg.sender` set for `account` and `configId`; reverts if there is none.
    function _config(bytes32 configId, address account)
        internal
        view
        returns (bytes memory packed)
    {
        bool exists;
        (exists, packed) = $.read(PolicyStorage.configKey(configId, msg.sender), account);
        if (!exists) revert PolicyNotInitialized(configId, msg.sender, account);
    }

    /// @dev The `index`th 32-byte word of `packed`, which must hold it.
    function _wordAt(bytes memory packed, uint256 index) internal pure returns (uint256 word) {
        assembly ("memory-safe") {
            word := mload(add(add(packed, 0x20), shl(5, index)))
        }
    }

    /// @dev Sets the `index`th 32-byte word of `packed`, which must hold it.
    function _setWordAt(bytes memory packed, uint256 index, uint256 word) internal pure {
        assembly ("memory-safe") {
            mstore(add(add(packed, 0x20), shl(5, index)), word)
        }
    }

    /// @dev `account`'s word of `counter` (a key derived from the configuration and period).
    function _counterOf(bytes32 counter, address account) internal view returns (uint256) {
        return $.counters[counter][account];
    }

    function _setCounter(bytes32 counter, address account, uint256 word) internal {
        $.counters[counter][account] = word;
    }
}
