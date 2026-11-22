// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {LimitPolicy} from "./lib/LimitPolicy.sol";

/// @title GasPolicy
/// @notice A budget of gas cost per period: each user operation counts its worst case, `maxFeePerGas` times every
/// gas limit it sets (verification, call, pre-verification and the paymaster's), since the actual cost is unknown
/// during validation.
/// @dev `initData` is `abi.encode(uint256 maxCost, uint256 period)`. Sponsored operations count too: the budget
/// limits what the session may consume, whoever pays.
// slither-disable-next-line missing-inheritance
contract GasPolicy is LimitPolicy {
    bytes32 internal constant TAG = keccak256("namera.gas");

    function checkUserOpPolicy(bytes32 id, ERC4337.PackedUserOperation calldata userOp)
        external
        returns (uint256)
    {
        (uint256 maxCost, uint256 period) =
            abi.decode(_config(id, userOp.sender), (uint256, uint256));
        Charge memory c = _begin(userOp);
        _charge(c, id, userOp.sender, TAG, maxCost, period, cost(userOp));
        return _end(c);
    }

    /// @notice The worst-case cost of `userOp` in wei.
    function cost(ERC4337.PackedUserOperation calldata userOp) public pure returns (uint256) {
        uint256 accountGasLimits = uint256(userOp.accountGasLimits);
        // `accountGasLimits` packs verificationGasLimit ‖ callGasLimit, 128 bits each.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 callGasLimit = uint128(accountGasLimits);
        uint256 gas = (accountGasLimits >> 128) + callGasLimit + userOp.preVerificationGas;
        // `paymasterAndData` is paymaster ‖ verification gas limit ‖ post-op gas limit (16 bytes each) ‖ data.
        if (userOp.paymasterAndData.length >= 52) {
            // forge-lint: disable-next-line(unsafe-typecast)
            gas += uint128(bytes16(userOp.paymasterAndData[20:36]))
            + uint128(bytes16(userOp.paymasterAndData[36:52]));
        }
        return gas * uint128(uint256(userOp.gasFees));
    }

    function _validateConfig(bytes calldata initData) internal pure override {
        abi.decode(initData, (uint256, uint256));
    }
}
