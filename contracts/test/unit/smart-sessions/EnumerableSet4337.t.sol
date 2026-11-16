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

    function test_remove_movesLastValueIntoTheGap() public {
        set.add(alice, "a");
        set.add(alice, "b");
        set.add(alice, "c");

        assertTrue(set.remove(alice, "a"));

        assertEq(set.length(alice), 2);
        assertEq(set.valueAt(alice, 0), "c");
        assertEq(set.valueAt(alice, 1), "b");
        assertFalse(set.contains(alice, "a"));
        assertTrue(set.contains(alice, "c"));
    }

    function test_removeMiddle_keepsOtherValues() public {
        set.add(alice, "a");
        set.add(alice, "b");
        set.add(alice, "c");

        set.remove(alice, "b");

        bytes32[] memory remaining = set.values(alice);
        assertEq(remaining.length, 2);
        assertEq(remaining[0], "a");
        assertEq(remaining[1], "c");
        assertFalse(set.contains(alice, "b"));
    }

    function test_remove_and_removeAll_zeroFreedSlots() public {
        uint256 arraySlot = uint256(keccak256(abi.encode(alice, uint256(0))));
        set.add(alice, "a");
        set.add(alice, "b");
        set.add(alice, "c");

        set.remove(alice, "a");
        assertEq(vm.load(address(set), bytes32(arraySlot + 3)), bytes32(0));

        set.removeAll(alice);
        assertEq(vm.load(address(set), bytes32(arraySlot + 1)), bytes32(0));
        assertEq(vm.load(address(set), bytes32(arraySlot + 2)), bytes32(0));
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

    /// @dev ERC-7562 associated storage: length at keccak256(account ‖ slot), element i at that slot + 1 + i.
    function test_storageIsAssociatedWithTheAccount() public {
        set.add(alice, "a");
        set.add(alice, "b");
        uint256 arraySlot = uint256(keccak256(abi.encode(alice, uint256(0))));

        assertEq(vm.load(address(set), bytes32(arraySlot)), bytes32(uint256(2)));
        assertEq(vm.load(address(set), bytes32(arraySlot + 1)), bytes32("a"));
        assertEq(vm.load(address(set), bytes32(arraySlot + 2)), bytes32("b"));
    }

    function testFuzz_valuesMatchContains(bytes32[] memory inputs) public {
        vm.assume(inputs.length <= 20);
        for (uint256 i; i < inputs.length; ++i) {
            set.add(alice, inputs[i]);
        }

        bytes32[] memory stored = set.values(alice);

        assertEq(stored.length, set.length(alice));
        for (uint256 i; i < inputs.length; ++i) {
            assertTrue(set.contains(alice, inputs[i]));
        }
    }
}
