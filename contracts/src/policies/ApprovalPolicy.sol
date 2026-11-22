// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {IActionPolicy} from "./interfaces/IPolicy.sol";
import {PolicyBase, VALIDATION_FAILED, VALIDATION_SUCCESS} from "./lib/PolicyBase.sol";

/// @title ApprovalPolicy
/// @notice Which spenders a session may approve, and for how much: ERC-20 `approve` and `increaseAllowance` on
/// the action's token, and Permit2's `approve(token, spender, amount, expiration)` for the listed tokens.
/// @dev `initData` is `abi.encode(address[] spenders, uint256 maxAmount, address[] tokens)`; `tokens` applies to
/// Permit2 calls (an ERC-20 approval's token is the action's target). Revoking (amount 0) is always allowed.
/// `maxAmount` bounds each approval and each `increaseAllowance`, not their sum. Any other function fails.
// slither-disable-next-line missing-inheritance
contract ApprovalPolicy is PolicyBase, IActionPolicy {
    bytes4 internal constant APPROVE = 0x095ea7b3;
    bytes4 internal constant INCREASE_ALLOWANCE = 0x39509351;
    /// @dev Permit2 `approve(address token, address spender, uint160 amount, uint48 expiration)`.
    bytes4 internal constant PERMIT2_APPROVE = 0x87517c45;

    function checkAction(bytes32 id, address account, address, uint256, bytes calldata data)
        external
        view
        returns (uint256)
    {
        (address[] memory spenders, uint256 maxAmount, address[] memory tokens) =
            abi.decode(_config(id, account), (address[], uint256, address[]));
        if (data.length < 4) return VALIDATION_FAILED;
        bytes4 selector = bytes4(data[:4]);

        address spender;
        uint256 amount;
        if (selector == APPROVE || selector == INCREASE_ALLOWANCE) {
            if (data.length < 68) return VALIDATION_FAILED;
            (spender, amount) = abi.decode(data[4:68], (address, uint256));
        } else if (selector == PERMIT2_APPROVE) {
            if (data.length < 132) return VALIDATION_FAILED;
            address token;
            (token, spender, amount) = abi.decode(data[4:100], (address, address, uint160));
            if (amount != 0 && !_contains(tokens, token)) return VALIDATION_FAILED;
        } else {
            return VALIDATION_FAILED;
        }

        if (amount == 0) return VALIDATION_SUCCESS;
        return amount <= maxAmount && _contains(spenders, spender)
            ? VALIDATION_SUCCESS
            : VALIDATION_FAILED;
    }

    function _contains(address[] memory list, address item) private pure returns (bool) {
        for (uint256 i; i < list.length; ++i) {
            if (list[i] == item) return true;
        }
        return false;
    }

    function _supportsKind(bytes4 interfaceId) internal pure override returns (bool) {
        return interfaceId == type(IActionPolicy).interfaceId;
    }

    function _validateConfig(bytes calldata initData) internal pure override {
        abi.decode(initData, (address[], uint256, address[]));
    }
}
