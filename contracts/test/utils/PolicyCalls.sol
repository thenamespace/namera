// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";
import {LibERC7579} from "solady/accounts/LibERC7579.sol";

import {UserOpCalls} from "src/policies/lib/UserOpCalls.sol";

/// @notice Builds the calldata and user operations Namera's policies read.
library PolicyCalls {
    bytes4 internal constant EXECUTE = 0xe9ae5c53;

    function single(address to, uint256 value, bytes memory data)
        internal
        pure
        returns (bytes memory)
    {
        bytes32 mode = LibERC7579.encodeMode(
            LibERC7579.CALLTYPE_SINGLE, LibERC7579.EXECTYPE_DEFAULT, bytes4(0), bytes22(0)
        );
        return abi.encodeWithSelector(EXECUTE, mode, abi.encodePacked(to, value, data));
    }

    function batch(UserOpCalls.Call[] memory calls) internal pure returns (bytes memory) {
        bytes32 mode = LibERC7579.encodeMode(
            LibERC7579.CALLTYPE_BATCH, LibERC7579.EXECTYPE_DEFAULT, bytes4(0), bytes22(0)
        );
        return abi.encodeWithSelector(EXECUTE, mode, abi.encode(calls));
    }

    /// @dev Appends the agent's stated time, as the SDK does for periodic limits.
    function withTime(bytes memory callData, uint256 t) internal pure returns (bytes memory) {
        return abi.encodePacked(callData, t);
    }

    function transfer(address to, uint256 amount) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(0xa9059cbb, to, amount);
    }

    function approve(address spender, uint256 amount) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(0x095ea7b3, spender, amount);
    }

    function op(address sender, bytes memory callData)
        internal
        pure
        returns (ERC4337.PackedUserOperation memory userOp)
    {
        userOp.sender = sender;
        userOp.callData = callData;
        userOp.accountGasLimits = bytes32((uint256(2_000_000) << 128) | 1_000_000);
        userOp.preVerificationGas = 100_000;
        userOp.gasFees = bytes32((uint256(1 gwei) << 128) | 1 gwei);
    }
}
