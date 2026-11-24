// SPDX-License-Identifier: LGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {ConfigId} from "../DataTypes.sol";

/// @notice A policy contract enforcing limits for Smart Sessions.
/// @dev Checks run during ERC-4337 validation, so policies must follow ERC-7562 storage and opcode rules. Keep
/// state as `configId => multiplexer (msg.sender) => account => state`, so it is associated with the account.
interface IPolicy {
    event PolicySet(ConfigId id, address multiplexer, address account);

    error PolicyNotInitialized(ConfigId id, address multiplexer, address account);

    /// @notice ERC-165: whether the policy implements `interfaceId`.
    /// @dev Policies report support for the policy type interfaces below.
    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    /// @notice Configures the policy for `account` and `configId`, overwriting any previous configuration.
    /// @dev Called while a session is enabled, possibly inside user operation validation; avoid external calls.
    function initializeWithMultiplexer(address account, ConfigId configId, bytes calldata initData)
        external;
}

/// @notice Policy run on every user operation of a session (e.g. gas or time limits).
/// @dev Returns ERC-4337 validation data: 0 (valid), 1 (invalid), or time bounds. Aggregator values are rejected.
interface IUserOpPolicy is IPolicy {
    /// @notice Checks `userOp` under the configuration `id`; returns ERC-4337 validation data.
    function checkUserOpPolicy(ConfigId id, ERC4337.PackedUserOperation calldata userOp)
        external
        returns (uint256);
}

/// @notice Policy run on each matching action (target and selector), including each call of a batch.
/// @dev Returns ERC-4337 validation data: 0 (valid), 1 (invalid), or time bounds.
interface IActionPolicy is IPolicy {
    /// @notice Checks a call of `account` to `target` under the configuration `id`; returns ERC-4337 validation data.
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
    /// @notice Whether the session key may sign `hash` for `requestSender` under the configuration `id`.
    function check1271SignedAction(
        ConfigId id,
        address requestSender,
        address account,
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bool);
}

/// @notice Namera extension: an ERC-1271 policy that reads the signed typed data, for conditions on its fields.
/// @dev Smart Sessions calls `check1271TypedData` instead of `check1271SignedAction` on policies that report this
/// interface through ERC-165. Smart Sessions has checked that `\x19\x01 ‖ appDomainSeparator ‖ contents` is the
/// requested hash and, when `contentsData` is not empty, that `keccak256(contentsData) == contents`: `contentsData`
/// is the struct's EIP-712 `encodeData` (its type hash, then one word per field, dynamic and nested fields hashed).
/// `policyData` is for the policy alone (such as the preimage of a nested field) and is not checked; a policy that
/// reads it verifies it against `contentsData`.
interface I1271TypedDataPolicy is I1271Policy {
    /// @notice Whether the session key may sign the typed data `contentsData` of `appDomainSeparator` for
    /// `requestSender` under the configuration `id`.
    function check1271TypedData(
        ConfigId id,
        address requestSender,
        address account,
        bytes32 appDomainSeparator,
        bytes calldata contentsData,
        bytes calldata policyData
    ) external view returns (bool);
}
