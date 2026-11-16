// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {FlatBytesLib} from "src/smart-sessions/lib/FlatBytesLib.sol";

contract FlatBytesHarness {
    using FlatBytesLib for FlatBytesLib.Bytes;

    FlatBytesLib.Bytes internal stored; // slot 0: length, slots 1..16: data

    function store(bytes memory data) external {
        stored.store(data);
    }

    /// @dev Stores `data` cut to `length` in memory, leaving the cut bytes behind as dirty memory.
    function storeTruncated(bytes memory data, uint256 length) external {
        assembly ("memory-safe") {
            mstore(data, length)
        }
        stored.store(data);
    }

    function load() external view returns (bytes memory) {
        return stored.load();
    }

    function clear() external {
        stored.clear();
    }
}

contract FlatBytesLibTest is Test {
    FlatBytesHarness internal harness;

    function setUp() public {
        harness = new FlatBytesHarness();
    }

    function testFuzz_roundTrip(bytes memory data) public {
        vm.assume(data.length <= FlatBytesLib.MAX_LENGTH);

        harness.store(data);

        assertEq(harness.load(), data);
    }

    function test_storesFullCapacity() public {
        bytes memory data = _filled(FlatBytesLib.MAX_LENGTH);

        harness.store(data);

        assertEq(harness.load(), data);
    }

    function test_RevertWhen_dataExceedsCapacity() public {
        bytes memory data = new bytes(FlatBytesLib.MAX_LENGTH + 1);

        vm.expectRevert(abi.encodeWithSelector(FlatBytesLib.DataTooLong.selector, data.length));
        harness.store(data);
    }

    /// @dev Upstream wrote `length / 32 + 1` slots, one past the struct for whole-word lengths.
    function test_writesOnlyTheSlotsItNeeds() public {
        harness.store(_filled(64));

        assertEq(_slot(0), bytes32(uint256(64)));
        assertNotEq(_slot(2), bytes32(0));
        assertEq(_slot(3), bytes32(0));
    }

    function test_zeroesBytesPastTheLength() public {
        harness.store(hex"aabbcc");

        assertEq(_slot(1), bytes32(hex"aabbcc"));
    }

    function testFuzz_zeroesDirtyMemoryPastTheLength(uint8 lengthSeed) public {
        uint256 length = bound(lengthSeed, 1, 63);
        bytes memory full = _filled(64);

        harness.storeTruncated(full, length);

        bytes memory expected = new bytes(length);
        for (uint256 i; i < length; ++i) {
            expected[i] = full[i];
        }
        assertEq(harness.load(), expected);
        bytes32 lastWord = _slot(1 + (length - 1) / 32);
        uint256 usedInLastWord = length % 32 == 0 ? 32 : length % 32;
        if (usedInLastWord < 32) {
            assertEq(uint256(lastWord) & (type(uint256).max >> (usedInLastWord * 8)), 0);
        }
    }

    function test_clear_zeroesLengthAndData() public {
        harness.store(_filled(100));

        harness.clear();

        for (uint256 i; i <= 4; ++i) {
            assertEq(_slot(i), bytes32(0));
        }
        assertEq(harness.load().length, 0);
    }

    function test_clear_atFullCapacity() public {
        harness.store(_filled(FlatBytesLib.MAX_LENGTH));

        harness.clear();

        assertEq(harness.load().length, 0);
        assertEq(_slot(FlatBytesLib.MAX_SLOTS), bytes32(0));
    }

    function _slot(uint256 index) internal view returns (bytes32) {
        return vm.load(address(harness), bytes32(index));
    }

    function _filled(uint256 length) internal pure returns (bytes memory data) {
        data = new bytes(length);
        for (uint256 i; i < length; ++i) {
            data[i] = bytes1(uint8(i % 255) + 1);
        }
    }
}
