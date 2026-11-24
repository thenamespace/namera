// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {EnumerableSet} from "src/smart-sessions/utils/EnumerableSet4337.sol";

contract EnumerableSetHarness {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    EnumerableSet.Bytes32Set internal set; // base slot 0

    function add(address account, bytes32 value) external returns (bool) {
        return set.add(account, value);
    }

    function remove(address account, bytes32 value) external returns (bool) {
        return set.remove(account, value);
    }

    function removeAll(address account) external {
        set.removeAll(account);
    }

    function contains(address account, bytes32 value) external view returns (bool) {
        return set.contains(account, value);
    }

    function length(address account) external view returns (uint256) {
        return set.length(account);
    }

    function valueAt(address account, uint256 index) external view returns (bytes32) {
        return set.valueAt(account, index);
    }

    function values(address account) external view returns (bytes32[] memory) {
        return set.values(account);
    }
}

contract EnumerableSet4337Test is Test {
    EnumerableSetHarness internal set;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        set = new EnumerableSetHarness();
    }

    function test_add_isIdempotent() public {
        assertTrue(set.add(alice, "a"));
        assertFalse(set.add(alice, "a"));

        assertEq(set.length(alice), 1);
        assertTrue(set.contains(alice, "a"));
    }

    function test_remove_keepsTheOtherValues() public {
        set.add(alice, "a");
        set.add(alice, "b");
        set.add(alice, "c");

        assertTrue(set.remove(alice, "b"));

        bytes32[] memory remaining = set.values(alice);
        assertEq(remaining.length, 2);
        assertTrue(remaining[0] != "b" && remaining[1] != "b");
        assertTrue(set.contains(alice, "a"));
        assertTrue(set.contains(alice, "c"));
        assertFalse(set.contains(alice, "b"));

        assertTrue(set.remove(alice, "a"));
        assertEq(set.values(alice)[0], "c");
    }

    function test_remove_returnsFalseForMissingValue() public {
        assertFalse(set.remove(alice, "missing"));
    }

    function test_removeAll_clearsValuesAndPositions() public {
        set.add(alice, "a");
        set.add(alice, "b");

        set.removeAll(alice);

        assertEq(set.length(alice), 0);
        assertFalse(set.contains(alice, "a"));
        assertTrue(set.add(alice, "a"));
        assertEq(set.length(alice), 1);
    }

    function test_setsAreIsolatedPerAccount() public {
        set.add(alice, "a");

        assertFalse(set.contains(bob, "a"));
        assertEq(set.values(bob).length, 0);
    }

    function test_RevertWhen_indexIsOutOfBounds() public {
        set.add(alice, "a");

        vm.expectRevert(
            abi.encodeWithSelector(EnumerableSet.AssociatedArray_OutOfBounds.selector, 1)
        );
        set.valueAt(alice, 1);
    }

    /// @dev Regression (set cap): the array's last slot, `slot + 127`, is the last ERC-7562 associates with the account,
    /// so a set holds at most 127 values.
    function test_RevertWhen_adding128thValue() public {
        for (uint256 i; i < 127; ++i) {
            set.add(alice, bytes32(i + 1));
        }
        assertEq(set.length(alice), 127);

        vm.expectRevert(
            abi.encodeWithSelector(EnumerableSet.AssociatedArray_OutOfBounds.selector, 127)
        );
        set.add(alice, bytes32(uint256(128)));
        // A value already held is still no addition.
        assertFalse(set.add(alice, bytes32(uint256(1))));
    }

    /// @dev ERC-7562 lets validation touch only storage associated with the account: `keccak256(account ‖ x) + n`,
    /// n ≤ 128. Here the array (at `keccak256(account ‖ 0)`) and each value's position (`_positions[value][account]`).
    function test_touchesOnlyStorageAssociatedWithTheAccount() public {
        set.add(bob, "a");
        vm.record();
        set.add(alice, "a");
        set.add(alice, "b");
        set.contains(alice, "b");
        set.remove(alice, "a");
        set.values(alice);
        (bytes32[] memory reads, bytes32[] memory writes) = vm.accesses(address(set));

        uint256 array = uint256(keccak256(abi.encode(alice, uint256(0))));
        for (uint256 i; i < reads.length + writes.length; ++i) {
            uint256 slot = uint256(i < reads.length ? reads[i] : writes[i - reads.length]);
            bool associated = (slot >= array && slot <= array + 128)
                || slot == _position(alice, "a") || slot == _position(alice, "b");
            assertTrue(associated, "a slot not associated with the account");
        }
    }

    function _position(address account, bytes32 value) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(account, keccak256(abi.encode(value, uint256(1))))));
    }

    function testFuzz_holdsEachDistinctValueOnce(uint8[] memory seeds) public {
        vm.assume(seeds.length <= 20);
        bool[16] memory seen;
        uint256 distinct;
        for (uint256 i; i < seeds.length; ++i) {
            uint256 value = seeds[i] % 16;
            set.add(alice, bytes32(value));
            if (!seen[value]) {
                seen[value] = true;
                ++distinct;
            }
        }

        bytes32[] memory stored = set.values(alice);

        assertEq(stored.length, distinct);
        for (uint256 i; i < stored.length; ++i) {
            assertTrue(seen[uint256(stored[i])]);
        }
    }
}
