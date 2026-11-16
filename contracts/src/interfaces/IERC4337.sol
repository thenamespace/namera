// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// ERC-4337 (EntryPoint v0.7) types used by modules, as specified in
// https://eips.ethereum.org/EIPS/eip-4337. ABI-identical to the EntryPoint's own definitions.

struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    /// verificationGasLimit (16 bytes) ‖ callGasLimit (16 bytes)
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    /// maxPriorityFeePerGas (16 bytes) ‖ maxFeePerGas (16 bytes)
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

interface IAccountExecute {
    function executeUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash) external;
}
