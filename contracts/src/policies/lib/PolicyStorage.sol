// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

/// @notice Storage for policies that ERC-7562 associates with the account, so bundlers accept it during validation.
/// @dev Every slot is a mapping whose innermost key is the account, `keccak256(account ‖ x)`, which ERC-7562
/// associates with the account. A policy's configuration is any byte string stored as words (length first), so
/// dynamic configurations need no dynamic storage arrays (their data slots would not be associated). Counters live
/// in their own mapping, keyed by the caller, so re-initialising a configuration never resets them.
library PolicyStorage {
    struct Layout {
        mapping(bytes32 slot => mapping(address account => bytes32 word)) words;
        mapping(bytes32 counter => mapping(address account => uint256 used)) counters;
    }

    /// @dev The key of `account`'s configuration of `configId` set by `multiplexer`.
    function configKey(bytes32 configId, address multiplexer) internal pure returns (bytes32) {
        return keccak256(abi.encode(configId, multiplexer));
    }

    /// @dev Stores `data` for `account` under `key`: word 0 is the length + 1 (so an unset configuration reads as
    /// absent), then the data in 32-byte words.
    function write(Layout storage $, bytes32 key, address account, bytes memory data) internal {
        uint256 length = data.length;
        $.words[key][account] = bytes32(length + 1);
        uint256 base = uint256(key);
        // forge-lint: disable-next-line(uninitialized-local)
        for (uint256 i; i < length; i += 32) {
            bytes32 word;
            assembly ("memory-safe") {
                word := mload(add(add(data, 0x20), i))
            }
            $.words[bytes32(base + 1 + i / 32)][account] = word;
        }
    }

    /// @dev Reads what `write` stored, and whether anything was.
    function read(Layout storage $, bytes32 key, address account)
        internal
        view
        returns (bool exists, bytes memory data)
    {
        uint256 stored = uint256($.words[key][account]);
        if (stored == 0) return (false, data);
        uint256 length = stored - 1;
        data = new bytes(length);
        uint256 base = uint256(key);
        // forge-lint: disable-next-line(uninitialized-local)
        for (uint256 i; i < length; i += 32) {
            bytes32 word = $.words[bytes32(base + 1 + i / 32)][account];
            assembly ("memory-safe") {
                mstore(add(add(data, 0x20), i), word)
            }
        }
        // The last word may carry bytes past `length` from memory beyond the array; `data`'s length bounds reads.
        return (true, data);
    }
}
