// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {LimitPolicy} from "./lib/LimitPolicy.sol";
import {UserOpCalls} from "./lib/UserOpCalls.sol";

/// @title SpendPolicy
/// @notice ERC-20 budgets per token and period, across every call of a user operation.
/// @dev `initData` is `abi.encode(Limit[])`. Each call to a limited token counts the amount of `transfer` and
/// `transferFrom`, and, when `countApprovals`, of `approve`, `increaseAllowance` and Permit2's `approve` of the token
/// (an approval lets a spender move the tokens later, so it is spending unless an `ApprovalPolicy` governs approvals
/// of the token). Any other function of a limited token counts as unlimited, failing the budget: the policy can't
/// tell what it moves (`transferAndCall`, `push`, share transfers). The requested amount counts, so fee-on-transfer
/// and rebasing tokens count what was asked, not what moved. Tokens a spender pulls with an allowance given before
/// the session are not seen; an execution policy measuring balances covers them. A token may have several limits
/// (a daily budget and a lifetime one); each is checked and charged.
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
    /// @dev Uniswap's Permit2 (the same address on every chain) and its `approve(address,address,uint160,uint48)`.
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    bytes4 internal constant PERMIT2_APPROVE = 0x87517c45;

    function checkUserOpPolicy(bytes32 id, ERC4337.PackedUserOperation calldata userOp)
        external
        returns (uint256)
    {
        bytes memory packed = _config(id, userOp.sender);
        UserOpCalls.Call[] memory calls = UserOpCalls.decode(userOp.callData, userOp.sender);
        Charge memory c = _begin(userOp);

        uint256 length = packed.length / 64;
        for (uint256 i; i < length; ++i) {
            Limit memory limit = _limitAt(packed, i);
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

    /// @dev The `index`th limit of a packed configuration: two words, `countApprovals ‖ token` and the budget.
    function _limitAt(bytes memory packed, uint256 index)
        private
        pure
        returns (Limit memory limit)
    {
        uint256 head = _wordAt(packed, 2 * index);
        // The low 160 bits are the token.
        // forge-lint: disable-next-line(unsafe-typecast)
        limit.token = address(uint160(head));
        limit.countApprovals = head >> 160 != 0;
        (limit.amount, limit.period) = _unpackBudget(_wordAt(packed, 2 * index + 1));
    }

    /// @dev The amount `call` spends of `limit.token`. A recognised call too short to hold its amount, or a function
    /// of the token the policy doesn't know, counts as unlimited, so it fails the budget.
    function _spent(UserOpCalls.Call memory call, Limit memory limit)
        private
        pure
        returns (uint256)
    {
        bytes memory data = call.data;
        if (call.target == PERMIT2) {
            // Permit2's `approve(token, spender, amount, expiration)` lets the spender pull the token through Permit2.
            // The first four bytes are the selector (at least four are there).
            // forge-lint: disable-next-line(unsafe-typecast)
            if (!limit.countApprovals || data.length < 4 || bytes4(data) != PERMIT2_APPROVE) {
                return 0;
            }
            if (data.length < 100) return type(uint256).max;
            // The words hold an `address` and a `uint160`: Permit2's ABI decoder reverts on anything wider.
            // forge-lint: disable-next-line(unsafe-typecast)
            if (address(uint160(_word(data, 4))) != limit.token) return 0;
            // forge-lint: disable-next-line(unsafe-typecast)
            return uint160(_word(data, 68));
        }
        if (call.target != limit.token || data.length == 0) return 0;
        if (data.length < 4) return type(uint256).max;
        // The first four bytes are the selector.
        // forge-lint: disable-next-line(unsafe-typecast)
        bytes4 selector = bytes4(data);
        uint256 offset;
        if (selector == TRANSFER) {
            offset = 36;
        } else if (selector == TRANSFER_FROM) {
            offset = 68;
        } else if (selector == APPROVE || selector == INCREASE_ALLOWANCE) {
            if (!limit.countApprovals) return 0;
            offset = 36;
        } else {
            return type(uint256).max;
        }
        if (data.length < offset + 32) return type(uint256).max;
        return _word(data, offset);
    }

    /// @dev The word at `offset` bytes into `data`, which must hold it.
    function _word(bytes memory data, uint256 offset) private pure returns (uint256 word) {
        assembly ("memory-safe") {
            word := mload(add(add(data, 0x20), offset))
        }
    }

    function _pack(bytes calldata initData) internal pure override returns (bytes memory packed) {
        Limit[] memory limits = abi.decode(initData, (Limit[]));
        packed = new bytes(64 * limits.length);
        for (uint256 i; i < limits.length; ++i) {
            Limit memory limit = limits[i];
            if (limit.token == address(0)) revert InvalidLimit(i);
            uint256 head = uint256(uint160(limit.token)) | (limit.countApprovals ? 1 << 160 : 0);
            _setWordAt(packed, 2 * i, head);
            _setWordAt(packed, 2 * i + 1, _packBudget(limit.amount, limit.period, i));
        }
    }
}
