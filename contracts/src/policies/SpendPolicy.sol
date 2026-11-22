// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {LimitPolicy} from "./lib/LimitPolicy.sol";
import {UserOpCalls} from "./lib/UserOpCalls.sol";

/// @title SpendPolicy
/// @notice ERC-20 budgets per token and period, across every call of a user operation.
/// @dev `initData` is `abi.encode(Limit[])`. Each call to a limited token counts the amount of `transfer`,
/// `transferFrom`, and, when `countApprovals`, `approve` and `increaseAllowance` (an approval lets a spender move
/// the tokens later, so it is spending unless an `ApprovalPolicy` governs approvals of the token). The requested
/// amount counts, so fee-on-transfer and rebasing tokens count what was asked, not what moved. A token may have
/// several limits (a daily budget and a lifetime one); each is checked and charged.
// slither-disable-next-line missing-inheritance
contract SpendPolicy is LimitPolicy {
    struct Limit {
        address token;
        uint256 amount;
        uint256 period;
        bool countApprovals;
    }

    bytes4 internal constant TRANSFER = 0xa9059cbb;
    bytes4 internal constant TRANSFER_FROM = 0x23b872dd;
    bytes4 internal constant APPROVE = 0x095ea7b3;
    bytes4 internal constant INCREASE_ALLOWANCE = 0x39509351;

    error InvalidLimit(uint256 index);

    function checkUserOpPolicy(bytes32 id, ERC4337.PackedUserOperation calldata userOp)
        external
        returns (uint256)
    {
        Limit[] memory limits = abi.decode(_config(id, userOp.sender), (Limit[]));
        UserOpCalls.Call[] memory calls = UserOpCalls.decode(userOp.callData, userOp.sender);
        Charge memory c = _begin(userOp);

        uint256 length = limits.length;
        for (uint256 i; i < length; ++i) {
            Limit memory limit = limits[i];
            uint256 spent = 0;
            for (uint256 j; j < calls.length; ++j) {
                spent += _spent(calls[j], limit);
            }
            _charge(
                c,
                id,
                userOp.sender,
                bytes32(uint256(uint160(limit.token))),
                limit.amount,
                limit.period,
                spent
            );
        }
        return _end(c);
    }

    /// @dev The amount `call` spends of `limit.token`. A recognised call too short to hold its amount counts as
    /// unlimited, so it fails the budget.
    function _spent(UserOpCalls.Call memory call, Limit memory limit)
        private
        pure
        returns (uint256)
    {
        if (call.target != limit.token) return 0;
        bytes memory data = call.data;
        if (data.length < 4) return 0;
        // The first four bytes are the selector.
        // forge-lint: disable-next-line(unsafe-typecast)
        bytes4 selector = bytes4(data);
        uint256 offset = 0;
        if (selector == TRANSFER) {
            offset = 36;
        } else if (selector == TRANSFER_FROM) {
            offset = 68;
        } else if (limit.countApprovals && (selector == APPROVE || selector == INCREASE_ALLOWANCE))
        {
            offset = 36;
        } else {
            return 0;
        }
        if (data.length < offset + 32) return type(uint256).max;
        uint256 amount;
        assembly ("memory-safe") {
            amount := mload(add(add(data, 0x20), offset))
        }
        return amount;
    }

    function _validateConfig(bytes calldata initData) internal pure override {
        Limit[] memory limits = abi.decode(initData, (Limit[]));
        for (uint256 i; i < limits.length; ++i) {
            if (limits[i].token == address(0)) revert InvalidLimit(i);
        }
    }
}
