// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {IActionPolicy} from "./interfaces/IPolicy.sol";
import {PolicyBase, VALIDATION_FAILED, VALIDATION_SUCCESS} from "./lib/PolicyBase.sol";

/// @title ApprovalPolicy
/// @notice Which spenders a session may approve, and for how much of each token: ERC-20 `approve` on a listed token,
/// and Permit2's `approve(token, spender, amount, expiration)` for a listed token.
/// @dev `initData` is `abi.encode(address[] spenders, Cap[] caps)`, a cap per token, so tokens with different decimals
/// get their own. The call must go to the token itself (ERC-20) or to Permit2, without value. Revoking (amount 0) is
/// always allowed. `increaseAllowance` is refused: repeated calls would add up past the cap, which `approve` (setting
/// the allowance) can't. Listed tokens must be ERC-20: an ERC-721's `approve(spender, tokenId)` has the same selector,
/// and token id 0 would read as a revocation. Any other function fails.
// slither-disable-next-line missing-inheritance
contract ApprovalPolicy is PolicyBase, IActionPolicy {
    struct Cap {
        address token;
        uint256 maxAmount;
    }

    bytes4 internal constant APPROVE = 0x095ea7b3;
    /// @dev Permit2 `approve(address token, address spender, uint160 amount, uint48 expiration)`.
    bytes4 internal constant PERMIT2_APPROVE = 0x87517c45;
    /// @dev Uniswap's Permit2, the same address on every chain.
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    function checkAction(
        bytes32 id,
        address account,
        address target,
        uint256 value,
        bytes calldata data
    ) external view returns (uint256) {
        (address[] memory spenders, Cap[] memory caps) =
            abi.decode(_config(id, account), (address[], Cap[]));
        if (value != 0 || data.length < 4) return VALIDATION_FAILED;
        bytes4 selector = bytes4(data[:4]);

        address token;
        address spender;
        uint256 amount;
        if (selector == APPROVE) {
            if (data.length < 68) return VALIDATION_FAILED;
            token = target;
            (spender, amount) = abi.decode(data[4:68], (address, uint256));
        } else if (selector == PERMIT2_APPROVE && target == PERMIT2) {
            if (data.length < 132) return VALIDATION_FAILED;
            (token, spender, amount) = abi.decode(data[4:100], (address, address, uint160));
        } else {
            return VALIDATION_FAILED;
        }

        (bool listed, uint256 maxAmount) = _cap(caps, token);
        if (!listed) return VALIDATION_FAILED;
        if (amount == 0) return VALIDATION_SUCCESS;
        return amount <= maxAmount && _contains(spenders, spender)
            ? VALIDATION_SUCCESS
            : VALIDATION_FAILED;
    }

    function _cap(Cap[] memory caps, address token) private pure returns (bool, uint256) {
        for (uint256 i; i < caps.length; ++i) {
            if (caps[i].token == token) return (true, caps[i].maxAmount);
        }
        return (false, 0);
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
        abi.decode(initData, (address[], Cap[]));
    }
}
