// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

bytes4 constant EIP1271_MAGIC_VALUE = 0x1626ba7e;

/// @notice https://eips.ethereum.org/EIPS/eip-1271
interface IERC1271 {
    function isValidSignature(bytes32 hash, bytes calldata signature)
        external
        view
        returns (bytes4 magicValue);
}
