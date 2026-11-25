// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {IActionPolicy, IUserOpPolicy} from "./interfaces/IPolicy.sol";
import {PolicyBase, VALIDATION_SUCCESS} from "./lib/PolicyBase.sol";

/// @title AllowPolicy
/// @notice Allows every action or user operation it is attached to. Smart Sessions rejects an action without a
/// policy, so a call the session allows without conditions uses this one. It has no configuration.
/// @dev Not an ERC-1271 policy: allowing every signature would let a session key sign anything.
// slither-disable-next-line missing-inheritance
contract AllowPolicy is PolicyBase, IActionPolicy, IUserOpPolicy {
    /// @inheritdoc IActionPolicy
    function checkAction(bytes32 id, address account, address, uint256, bytes calldata)
        external
        view
        returns (uint256)
    {
        _config(id, account);
        return VALIDATION_SUCCESS;
    }

    /// @inheritdoc IUserOpPolicy
    function checkUserOpPolicy(bytes32 id, ERC4337.PackedUserOperation calldata userOp)
        external
        view
        returns (uint256)
    {
        _config(id, userOp.sender);
        return VALIDATION_SUCCESS;
    }

    function _supportsKind(bytes4 interfaceId) internal pure override returns (bool) {
        return interfaceId == type(IActionPolicy).interfaceId
            || interfaceId == type(IUserOpPolicy).interfaceId;
    }

    /// @dev The policy has no configuration: it stores nothing but that it is set.
    function _pack(bytes calldata) internal pure override returns (bytes memory) {
        return "";
    }
}
