// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

/// @notice Smart Sessions' policy interfaces with the same ABI as `src/smart-sessions/interfaces/IPolicy.sol`
/// (LGPL-3.0), written independently so Namera's policies stay Apache-2.0. `ConfigId` is a `bytes32` user-defined
/// value type there, so `bytes32` here gives identical selectors and interface ids (checked by a test).
/// @dev Smart Sessions (the multiplexer, `msg.sender`) calls these during ERC-4337 validation, so implementations
/// follow ERC-7562: no banned opcodes (TIMESTAMP included) and storage associated with the account.
interface IPolicy {
    event PolicySet(bytes32 id, address multiplexer, address account);

    error PolicyNotInitialized(bytes32 id, address multiplexer, address account);

    /// @notice ERC-165: whether the policy implements `interfaceId`, including the policy kinds below.
    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    /// @notice Configures the policy for `account` and `configId`, overwriting any previous configuration.
    function initializeWithMultiplexer(address account, bytes32 configId, bytes calldata initData)
        external;
}

/// @notice Runs on every user operation of a session. Returns ERC-4337 validation data.
interface IUserOpPolicy is IPolicy {
    /// @notice Checks `userOp` under the configuration `id`; returns ERC-4337 validation data.
    function checkUserOpPolicy(bytes32 id, ERC4337.PackedUserOperation calldata userOp)
        external
        returns (uint256);
}

/// @notice Runs on each matching action (target and selector), including each call of a batch.
interface IActionPolicy is IPolicy {
    /// @notice Checks a call of `account` to `target` under the configuration `id`; returns ERC-4337 validation data.
    function checkAction(
        bytes32 id,
        address account,
        address target,
        uint256 value,
        bytes calldata data
    ) external returns (uint256);
}

/// @notice Runs when a session key signs an ERC-1271 request; `requestSender` is the verifying contract.
interface I1271Policy is IPolicy {
    /// @notice Whether the session key may sign `hash` for `requestSender` under the configuration `id`.
    function check1271SignedAction(
        bytes32 id,
        address requestSender,
        address account,
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bool);
}

/// @notice Runs instead of `check1271SignedAction` when the policy reports this interface: Smart Sessions passes
/// the signed typed data. `\x19\x01 ‖ appDomainSeparator ‖ keccak256(contentsData)` is the requested hash when
/// `contentsData` (the struct's EIP-712 `encodeData`) is not empty; `policyData` is unchecked.
interface I1271TypedDataPolicy is I1271Policy {
    /// @notice Whether the session key may sign the typed data `contentsData` of `appDomainSeparator` for
    /// `requestSender` under the configuration `id`.
    function check1271TypedData(
        bytes32 id,
        address requestSender,
        address account,
        bytes32 appDomainSeparator,
        bytes calldata contentsData,
        bytes calldata policyData
    ) external view returns (bool);
}
