// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {LimitPolicy} from "./lib/LimitPolicy.sol";
import {UserOpCalls} from "./lib/UserOpCalls.sol";

/// @title ValuePolicy
/// @notice A budget of native currency per period, across every call of a user operation.
/// @dev `initData` is `abi.encode(uint256 amount, uint256 period)`.
// slither-disable-next-line missing-inheritance
contract ValuePolicy is LimitPolicy {
    bytes32 internal constant TAG = keccak256("namera.value");

    function checkUserOpPolicy(bytes32 id, ERC4337.PackedUserOperation calldata userOp)
        external
        returns (uint256)
    {
        (uint256 amount, uint256 period) = _budget(id, userOp.sender);
        UserOpCalls.Call[] memory calls = UserOpCalls.decode(userOp.callData, userOp.sender);
        Charge memory c = _begin(userOp);

        uint256 value = 0;
        for (uint256 i; i < calls.length; ++i) {
            value += calls[i].value;
        }
        _charge(c, id, userOp.sender, TAG, amount, period, value);
        return _end(c);
    }
}
