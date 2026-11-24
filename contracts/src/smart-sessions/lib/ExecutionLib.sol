// SPDX-License-Identifier: Apache-2.0
// Derived from erc7579/smartsessions@f5aaf86 (MIT; Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

/// @dev ERC-7579 batch execution entry.
struct Execution {
    address target;
    uint256 value;
    bytes callData;
}

/// @notice Decodes ERC-7579 `execute(bytes32 mode, bytes executionCalldata)` user operation calldata.
/// @dev Single executions and execution modes are decoded with Solady's LibERC7579. Batches are decoded into a typed
/// `Execution[] calldata` so Solidity validates every field on access: SmartSession compares `target` against
/// `msg.sender` and `address(this)`, which must not see dirty upper address bits.
library ExecutionLib {
    /// @dev Returns `executionCalldata` from `execute(bytes32,bytes)` calldata, with bounds checks.
    function decodeUserOpCallData(bytes calldata userOpCallData)
        internal
        pure
        returns (bytes calldata erc7579ExecutionCalldata)
    {
        assembly ("memory-safe") {
            if lt(userOpCallData.length, 68) { revert(0, 0) }
            let baseOffset := add(userOpCallData.offset, 0x24) // Skips the selector and the execution mode.
            let calldataLoadOffset := calldataload(baseOffset)
            if gt(calldataLoadOffset, 0xffffffffffffffff) { revert(0, 0) }
            erc7579ExecutionCalldata.offset := add(baseOffset, calldataLoadOffset)
            erc7579ExecutionCalldata.length := calldataload(
                sub(erc7579ExecutionCalldata.offset, 0x20)
            )
            if gt(erc7579ExecutionCalldata.length, 0xffffffffffffffff) { revert(0, 0) }

            // Reverts if the execution calldata starts or ends after the user operation calldata.
            let calldataBound := add(userOpCallData.offset, userOpCallData.length)
            if gt(erc7579ExecutionCalldata.offset, calldataBound) { revert(0, 0) }
            if gt(
                add(erc7579ExecutionCalldata.offset, erc7579ExecutionCalldata.length),
                calldataBound
            ) { revert(0, 0) }
        }
    }

    /// @dev Returns the ERC-7579 execution mode of `execute(bytes32,bytes)` calldata.
    function executionMode(bytes calldata userOpCallData) internal pure returns (bytes32) {
        return bytes32(userOpCallData[4:36]);
    }

    /// @dev Bounds checks as in Solady's `LibERC7579.decodeBatch`, returning typed executions.
    function decodeBatch(bytes calldata executionCalldata)
        internal
        pure
        returns (Execution[] calldata executionBatch)
    {
        assembly ("memory-safe") {
            let u := calldataload(executionCalldata.offset)
            let s := add(executionCalldata.offset, u)
            let e := sub(add(executionCalldata.offset, executionCalldata.length), 0x20)
            executionBatch.offset := add(s, 0x20)
            executionBatch.length := calldataload(s)
            if or(shr(64, u), gt(add(s, shl(5, executionBatch.length)), e)) {
                mstore(0x00, 0xba597e7e) // `DecodingError()`.
                revert(0x1c, 0x04)
            }
            if executionBatch.length {
                // Loop runs out-of-gas if `executionBatch.length` is big enough to cause overflows.
                for { let i := executionBatch.length } 1 {} {
                    i := sub(i, 1)
                    let p := calldataload(add(executionBatch.offset, shl(5, i)))
                    let c := add(executionBatch.offset, p)
                    let q := calldataload(add(c, 0x40))
                    let o := add(c, q)
                    // forgefmt: disable-next-item
                    if or(shr(64, or(calldataload(o), or(p, q))),
                        or(gt(add(c, 0x40), e), gt(add(o, calldataload(o)), e))) {
                        mstore(0x00, 0xba597e7e) // `DecodingError()`.
                        revert(0x1c, 0x04)
                    }
                    if iszero(i) { break }
                }
            }
        }
    }
}
