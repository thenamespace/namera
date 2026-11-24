// SPDX-License-Identifier: Apache-2.0
// Derived from erc7579/smartsessions@f5aaf86 (MIT; Rhinestone): EnumerableSet4337 and AssociatedArrayLib, themselves
// forked from OpenZeppelin's EnumerableSet (MIT). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

/// @notice Enumerable sets kept per account in ERC-7562 associated storage.
/// @dev Each set stores, per account, an array at `keccak256(account ‖ set.slot)`: the length at that slot and
/// element `i` at `slot + 1 + i`, plus a position map `value => account => index + 1`. Every slot is derived
/// from the account, so validation-time reads are allowed by ERC-7562 as long as a set holds at most 127 values.
library EnumerableSet {
    struct Set {
        // The base slot only: the array lives at `keccak256(account ‖ this slot)`.
        uint256 _array;
        mapping(bytes32 value => mapping(address account => uint256)) _positions;
    }

    struct Bytes32Set {
        Set _inner;
    }

    struct AddressSet {
        Set _inner;
    }

    error AssociatedArray_OutOfBounds(uint256 index);

    /// @dev Returns true if `value` was added (not already present).
    function add(Bytes32Set storage set, address account, bytes32 value) internal returns (bool) {
        return _add(set._inner, account, value);
    }

    /// @dev Returns true if `value` was removed (was present). Does not preserve order.
    function remove(Bytes32Set storage set, address account, bytes32 value)
        internal
        returns (bool)
    {
        return _remove(set._inner, account, value);
    }

    /// @dev Empties `account`'s set.
    function removeAll(Bytes32Set storage set, address account) internal {
        _removeAll(set._inner, account);
    }

    function contains(Bytes32Set storage set, address account, bytes32 value)
        internal
        view
        returns (bool)
    {
        return set._inner._positions[value][account] != 0;
    }

    function length(Bytes32Set storage set, address account) internal view returns (uint256) {
        return _length(set._inner, account);
    }

    /// @dev The value at `index` of `account`'s array; reverts past its end.
    function valueAt(Bytes32Set storage set, address account, uint256 index)
        internal
        view
        returns (bytes32)
    {
        return _valueAt(set._inner, account, index);
    }

    function values(Bytes32Set storage set, address account)
        internal
        view
        returns (bytes32[] memory)
    {
        return _values(set._inner, account);
    }

    /// @dev Returns true if `value` was added (not already present).
    function add(AddressSet storage set, address account, address value) internal returns (bool) {
        return _add(set._inner, account, bytes32(uint256(uint160(value))));
    }

    /// @dev Returns true if `value` was removed (was present). Does not preserve order.
    function remove(AddressSet storage set, address account, address value)
        internal
        returns (bool)
    {
        return _remove(set._inner, account, bytes32(uint256(uint160(value))));
    }

    /// @dev Empties `account`'s set.
    function removeAll(AddressSet storage set, address account) internal {
        _removeAll(set._inner, account);
    }

    function contains(AddressSet storage set, address account, address value)
        internal
        view
        returns (bool)
    {
        return set._inner._positions[bytes32(uint256(uint160(value)))][account] != 0;
    }

    function length(AddressSet storage set, address account) internal view returns (uint256) {
        return _length(set._inner, account);
    }

    function values(AddressSet storage set, address account)
        internal
        view
        returns (address[] memory result)
    {
        bytes32[] memory words = _values(set._inner, account);
        // Elements were stored from addresses, so the words are clean.
        assembly ("memory-safe") {
            result := words
        }
    }

    /// @dev The slot of `account`'s array (its length; element `i` is at `slot + 1 + i`).
    function _arraySlot(Set storage set, address account) private pure returns (uint256 slot) {
        assembly ("memory-safe") {
            mstore(0x00, account)
            mstore(0x20, set.slot)
            slot := keccak256(0x00, 0x40)
        }
    }

    function _length(Set storage set, address account) private view returns (uint256 n) {
        uint256 slot = _arraySlot(set, account);
        assembly ("memory-safe") {
            n := sload(slot)
        }
    }

    function _valueAt(Set storage set, address account, uint256 index)
        private
        view
        returns (bytes32 value)
    {
        uint256 slot = _arraySlot(set, account);
        assembly ("memory-safe") {
            if iszero(lt(index, sload(slot))) {
                mstore(0x00, 0x8277484f) // `AssociatedArray_OutOfBounds(uint256)`.
                mstore(0x20, index)
                revert(0x1c, 0x24)
            }
            value := sload(add(slot, add(index, 1)))
        }
    }

    function _values(Set storage set, address account)
        private
        view
        returns (bytes32[] memory result)
    {
        uint256 slot = _arraySlot(set, account);
        uint256 n;
        assembly ("memory-safe") {
            n := sload(slot)
        }
        result = new bytes32[](n);
        for (uint256 i; i < n; ++i) {
            bytes32 value;
            assembly ("memory-safe") {
                value := sload(add(slot, add(i, 1)))
            }
            result[i] = value;
        }
    }

    function _add(Set storage set, address account, bytes32 value) private returns (bool) {
        if (set._positions[value][account] != 0) return false;
        uint256 slot = _arraySlot(set, account);
        uint256 n;
        assembly ("memory-safe") {
            n := sload(slot)
            sstore(add(slot, add(n, 1)), value)
            sstore(slot, add(n, 1))
        }
        set._positions[value][account] = n + 1;
        return true;
    }

    /// @dev Swap-and-pop: the last element moves into the removed element's place.
    function _remove(Set storage set, address account, bytes32 value) private returns (bool) {
        uint256 position = set._positions[value][account];
        if (position == 0) return false;

        uint256 slot = _arraySlot(set, account);
        uint256 n;
        assembly ("memory-safe") {
            n := sload(slot)
        }
        // Element with 1-based position `p` is stored at `slot + p`.
        if (position != n) {
            bytes32 last;
            assembly ("memory-safe") {
                last := sload(add(slot, n))
                sstore(add(slot, position), last)
            }
            set._positions[last][account] = position;
        }
        assembly ("memory-safe") {
            sstore(add(slot, n), 0)
            sstore(slot, sub(n, 1))
        }
        delete set._positions[value][account];
        return true;
    }

    function _removeAll(Set storage set, address account) private {
        uint256 slot = _arraySlot(set, account);
        uint256 n;
        assembly ("memory-safe") {
            n := sload(slot)
        }
        for (uint256 i = 1; i <= n; ++i) {
            bytes32 value;
            assembly ("memory-safe") {
                value := sload(add(slot, i))
                sstore(add(slot, i), 0)
            }
            delete set._positions[value][account];
        }
        assembly ("memory-safe") {
            sstore(slot, 0)
        }
    }
}
