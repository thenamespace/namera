// SPDX-License-Identifier: Apache-2.0
// Derived from rhinestonewtf/flatbytes@bb0859e (MIT; Rhinestone). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

/// @notice Stores `bytes` in consecutive storage slots after a length slot, so validation-time reads stay
/// within ERC-7562 associated storage (Solidity's and Solady's bytes storage use `keccak256(slot)`).
/// @dev Holds up to 2,304 bytes: 16 passkeys (96 + 128 × n bytes) or 69 ECDSA signers (96 + 32 × n). The data ends
/// 74 slots past the struct's base, inside ERC-7562's 128. `store` expects cleared
/// storage: SmartSession only stores a validator config when none is set, and `clear`s it on removal.
library FlatBytesLib {
    // Declared before `Bytes`, whose array length it sets: the compiler requires that order.
    uint256 internal constant MAX_SLOTS = 72;
    uint256 internal constant MAX_LENGTH = MAX_SLOTS * 32;

    struct Bytes {
        uint256 totalLength;
        bytes32[MAX_SLOTS] data;
    }

    error DataTooLong(uint256 length);

    /// @dev Stores `data` in cleared storage; reverts past `MAX_LENGTH` bytes.
    function store(Bytes storage self, bytes memory data) internal {
        uint256 length = data.length;
        if (length > MAX_LENGTH) revert DataTooLong(length);

        self.totalLength = length;
        uint256 slots = (length + 31) / 32;
        for (uint256 i; i < slots; ++i) {
            bytes32 word;
            assembly ("memory-safe") {
                word := mload(add(data, shl(5, add(i, 1))))
            }
            // Zero the bytes past `length` in the last word.
            uint256 used = length - i * 32;
            if (used < 32) word &= ~bytes32(type(uint256).max >> (used * 8));
            self.data[i] = word;
        }
    }

    /// @dev Zeroes the slots `store` wrote and the length.
    function clear(Bytes storage self) internal {
        uint256 slots = (self.totalLength + 31) / 32;
        for (uint256 i; i < slots; ++i) {
            delete self.data[i];
        }
        self.totalLength = 0;
    }

    /// @dev Reads back what `store` wrote.
    function load(Bytes storage self) internal view returns (bytes memory data) {
        uint256 length = self.totalLength;
        data = new bytes(length);
        uint256 slots = (length + 31) / 32;
        for (uint256 i; i < slots; ++i) {
            bytes32 word = self.data[i];
            assembly ("memory-safe") {
                mstore(add(data, shl(5, add(i, 1))), word)
            }
        }
    }
}
