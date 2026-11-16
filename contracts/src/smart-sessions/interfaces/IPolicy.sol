// SPDX-License-Identifier: LGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import {ConfigId} from "../DataTypes.sol";
import {ERC4337} from "solady/accounts/ERC4337.sol";

/// @notice A policy contract enforcing limits for Smart Sessions.
/// @dev Checks run during ERC-4337 validation, so policies must follow ERC-7562 storage and opcode rules. Keep
/// state as `configId => multiplexer (msg.sender) => account => state`, so it is associated with the account.
interface IPolicy {
    event PolicySet(ConfigId id, address multiplexer, address account);

    error PolicyNotInitialized(ConfigId id, address multiplexer, address account);

    /// @dev ERC-165. Policies report support for the policy type interfaces below.
    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    /// @notice Configures the policy for `account` and `configId`, overwriting any previous configuration.
    /// @dev Called while a session is enabled, possibly inside user operation validation; avoid external calls.
    function initializeWithMultiplexer(address account, ConfigId configId, bytes calldata initData)
        external;
}

/// @notice Policy run on every user operation of a session (e.g. gas or time limits).
/// @dev Returns ERC-4337 validation data: 0 (valid), 1 (invalid), or time bounds. Aggregator values are rejected.
interface IUserOpPolicy is IPolicy {
    function checkUserOpPolicy(ConfigId id, ERC4337.PackedUserOperation calldata userOp)
        external
        returns (uint256);
}

/// @notice Policy run on each matching action (target and selector), including each call of a batch.
/// @dev Returns ERC-4337 validation data: 0 (valid), 1 (invalid), or time bounds.
interface IActionPolicy is IPolicy {
    function checkAction(
        ConfigId id,
        address account,
        address target,
        uint256 value,
        bytes calldata data
    ) external returns (uint256);
}

/// @notice Policy run when a session key signs an ERC-1271 request; `requestSender` is the verifying contract.
interface I1271Policy is IPolicy {
    function check1271SignedAction(
        ConfigId id,
        address requestSender,
        address account,
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bool);
}
