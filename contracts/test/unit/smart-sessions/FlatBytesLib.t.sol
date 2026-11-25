// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {FlatBytesLib} from "src/smart-sessions/lib/FlatBytesLib.sol";

contract FlatBytesHarness {
    using FlatBytesLib for FlatBytesLib.Bytes;

    FlatBytesLib.Bytes internal stored;
    uint256 public neighbour = type(uint256).max;

    function store(bytes memory data) external {
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

    function test_RevertWhen_dataExceedsCapacity() public {
        bytes memory data = new bytes(FlatBytesLib.MAX_LENGTH + 1);

        vm.expectRevert(abi.encodeWithSelector(FlatBytesLib.DataTooLong.selector, data.length));
        harness.store(data);
    }

    /// @dev Upstream wrote `length / 32 + 1` slots, one past the struct for whole-word lengths.
    function test_fullCapacity_leavesTheNextStorageIntact() public {
        bytes memory data = _filled(FlatBytesLib.MAX_LENGTH);

        harness.store(data);

        assertEq(harness.load(), data);
        assertEq(harness.neighbour(), type(uint256).max);
    }

    function test_clear_emptiesTheValueAndLeavesTheNextStorageIntact() public {
        harness.store(_filled(FlatBytesLib.MAX_LENGTH));

        harness.clear();

        assertEq(harness.load().length, 0);
        assertEq(harness.neighbour(), type(uint256).max);
    }

    function _filled(uint256 length) internal pure returns (bytes memory data) {
        data = new bytes(length);
        for (uint256 i; i < length; ++i) {
            data[i] = bytes1(uint8(i % 255) + 1);
        }
    }
}
