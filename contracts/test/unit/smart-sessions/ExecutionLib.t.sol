// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {Execution, ExecutionLib} from "src/smart-sessions/lib/ExecutionLib.sol";

contract ExecutionLibHarness {
    function executionCalldata(bytes calldata userOpCallData) external pure returns (bytes memory) {
        return ExecutionLib.decodeUserOpCallData(userOpCallData);
    }

    function executionMode(bytes calldata userOpCallData) external pure returns (bytes32) {
        return ExecutionLib.executionMode(userOpCallData);
    }

    function batch(bytes calldata encodedBatch) external pure returns (Execution[] memory) {
        return ExecutionLib.decodeBatch(encodedBatch);
    }
}

contract ExecutionLibTest is Test {
    bytes4 internal constant EXECUTE = 0xe9ae5c53;
    bytes4 internal constant DECODING_ERROR = 0xba597e7e;

    ExecutionLibHarness internal harness;

    function setUp() public {
        harness = new ExecutionLibHarness();
    }

    function testFuzz_extractsExecutionCalldataAndMode(bytes32 mode, bytes memory data)
        public
        view
    {
        bytes memory callData = abi.encodeWithSelector(EXECUTE, mode, data);

        assertEq(harness.executionCalldata(callData), data);
        assertEq(harness.executionMode(callData), mode);
    }

    function test_RevertWhen_calldataIsTooShort() public {
        vm.expectRevert();
        harness.executionCalldata(abi.encodePacked(EXECUTE, bytes32(0)));
    }

    function test_RevertWhen_executionCalldataPointsOutOfBounds() public {
        bytes memory callData = abi.encodePacked(EXECUTE, bytes32(0), uint256(0x1000), uint256(0));

        vm.expectRevert();
        harness.executionCalldata(callData);
    }

    function test_RevertWhen_executionCalldataLengthExceedsCalldata() public {
        bytes memory callData =
            abi.encodePacked(EXECUTE, bytes32(0), uint256(0x40), uint256(1000), bytes32(0));

        vm.expectRevert();
        harness.executionCalldata(callData);
    }

    function testFuzz_decodesBatch(address to, uint256 value, bytes memory data) public view {
        Execution[] memory executions = new Execution[](2);
        executions[0] = Execution(to, value, data);
        executions[1] = Execution(address(this), 0, "");

        Execution[] memory decoded = harness.batch(abi.encode(executions));

        assertEq(decoded.length, 2);
        assertEq(decoded[0].target, to);
        assertEq(decoded[0].value, value);
        assertEq(decoded[0].callData, data);
        assertEq(decoded[1].target, address(this));
    }

    function test_RevertWhen_batchLengthExceedsCalldata() public {
        bytes memory malformed = abi.encodePacked(uint256(0x20), uint256(100), bytes32(0));

        vm.expectRevert(DECODING_ERROR);
        harness.batch(malformed);
    }

    function test_RevertWhen_batchEntryPointsOutOfBounds() public {
        Execution[] memory executions = new Execution[](1);
        executions[0] = Execution(address(1), 0, hex"aabbcc");
        bytes memory encoded = abi.encode(executions);
        // Corrupt the offset of the first execution.
        assembly ("memory-safe") {
            mstore(add(encoded, 0x60), 0xffffff)
        }

        vm.expectRevert(DECODING_ERROR);
        harness.batch(encoded);
    }

    function test_RevertWhen_batchTargetHasDirtyUpperBits() public {
        Execution[] memory executions = new Execution[](1);
        executions[0] = Execution(address(1), 0, "");
        bytes memory encoded = abi.encode(executions);
        // Target word of the first execution: offset 0x20 (array) + 0x20 (length) + 0x20 (pointer).
        assembly ("memory-safe") {
            mstore(add(encoded, 0x80), not(0))
        }

        vm.expectRevert();
        harness.batch(encoded);
    }

    function test_RevertWhen_executionCalldataLengthExceedsBatch() public {
        _expectCorruptedBatchToRevert(0xc0, 0x1000);
    }

    /// @dev Encodes a one-execution batch and overwrites the word at `position` (byte offset in the encoding):
    /// 0x00 array offset, 0x20 length, 0x40 entry pointer, 0x60 target, 0x80 value, 0xa0 calldata offset,
    /// 0xc0 calldata length.
    function _expectCorruptedBatchToRevert(uint256 position, uint256 word) internal {
        Execution[] memory executions = new Execution[](1);
        executions[0] = Execution(address(1), 0, hex"aabbcc");
        bytes memory encoded = abi.encode(executions);
        assembly ("memory-safe") {
            mstore(add(add(encoded, 0x20), position), word)
        }

        vm.expectRevert(DECODING_ERROR);
        harness.batch(encoded);
    }
}
