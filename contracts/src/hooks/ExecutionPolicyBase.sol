// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {IPolicy} from "../policies/interfaces/IPolicy.sol";
import {IExecutionPolicy} from "./interfaces/IExecutionPolicy.sol";

/// @title ExecutionPolicyBase
/// @notice A starting point for application execution policies run by `SessionHook`: ERC-165, the configuration
/// event, and every call passed on with the multiplexer (`SessionHook`) so state is keyed `id → multiplexer →
/// account`. Not deployed by Namera: applications inherit it.
/// @dev Rules for implementations:
/// - `_configure` runs during ERC-4337 validation (enable mode): follow ERC-7562 there, with storage keyed by the
///   account and no banned opcodes.
/// - `_preCheck` and `_postCheck` run during execution: oracles, balances and the clock are fine.
/// - The agent writes the whole batch, so value with an oracle, never a pool price the batch can move, and measure
///   outcomes (balances before and after) rather than trusting decoded calldata.
/// - Revert to reject the operation; keep gas bounded, since a policy that runs out of gas rejects every operation of
///   its session.
abstract contract ExecutionPolicyBase is IExecutionPolicy {
    function supportsInterface(bytes4 interfaceId) external pure virtual returns (bool) {
        return interfaceId == type(IExecutionPolicy).interfaceId
            || interfaceId == type(IPolicy).interfaceId || interfaceId == 0x01ffc9a7;
    }

    function initializeWithMultiplexer(address account, bytes32 id, bytes calldata initData)
        external
    {
        _configure(id, msg.sender, account, initData);
        emit PolicySet(id, msg.sender, account);
    }

    function preCheck(bytes32 id, address account, bytes calldata execData)
        external
        returns (bytes memory context)
    {
        return _preCheck(id, msg.sender, account, execData);
    }

    function postCheck(bytes32 id, address account, bytes calldata context) external {
        _postCheck(id, msg.sender, account, context);
    }

    /// @dev Stores the session's configuration of this policy; overwrites any earlier one.
    function _configure(bytes32 id, address multiplexer, address account, bytes calldata initData)
        internal
        virtual;

    /// @dev Before the calls: returns what `_postCheck` needs, such as balances.
    function _preCheck(bytes32 id, address multiplexer, address account, bytes calldata execData)
        internal
        virtual
        returns (bytes memory context);

    /// @dev After the calls: reverts to reject the operation.
    function _postCheck(bytes32 id, address multiplexer, address account, bytes calldata context)
        internal
        virtual;
}
