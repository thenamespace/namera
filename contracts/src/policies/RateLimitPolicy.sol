// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {LimitPolicy} from "./lib/LimitPolicy.sol";

/// @title RateLimitPolicy
/// @notice At most `count` user operations per period.
/// @dev `initData` is `abi.encode(uint256 count, uint256 period)`.
// slither-disable-next-line missing-inheritance
contract RateLimitPolicy is LimitPolicy {
    bytes32 internal constant TAG = keccak256("namera.rate-limit");

    function checkUserOpPolicy(bytes32 id, ERC4337.PackedUserOperation calldata userOp)
        external
        returns (uint256)
    {
        (uint256 count, uint256 period) = abi.decode(_config(id, userOp.sender), (uint256, uint256));
        Charge memory c = _begin(userOp);
        _charge(c, id, userOp.sender, TAG, count, period, 1);
        return _end(c);
    }

    function _validateConfig(bytes calldata initData) internal pure override {
        abi.decode(initData, (uint256, uint256));
    }
}
