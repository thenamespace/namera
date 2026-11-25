// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {IPolicy} from "../../policies/interfaces/IPolicy.sol";

/// @notice A check that runs around a session operation's calls, through `SessionHook`: `preCheck` before the calls
/// and `postCheck` after. Unlike validation policies, execution policies run in the execution phase, where ERC-7562
/// does not apply: they may read oracles, balances and the clock.
/// @dev `SessionHook` is the multiplexer (`msg.sender`) and calls `initializeWithMultiplexer` when the session is
/// enabled, which happens during validation in enable mode, so initialization follows ERC-7562. Key state by
/// `id → msg.sender → account`. Revert to reject the operation; `SessionHook` never catches a failure.
/// The batch is the agent's: value holdings with an oracle, never a pool price the same batch can move, and measure
/// outcomes (balances before and after) rather than trusting decoded calldata.
interface IExecutionPolicy is IPolicy {
    /// @notice Runs before the operation's calls; reverts to reject the operation.
    /// @param id The policy's configuration id for this session.
    /// @param execData The account's `execute(mode, executionCalldata)` calldata, Namera's tail included.
    /// @return context Data `postCheck` gets back, such as balances before the calls.
    function preCheck(bytes32 id, address account, bytes calldata execData)
        external
        returns (bytes memory context);

    /// @notice Runs after the operation's calls with what `preCheck` returned; reverts to reject the operation.
    function postCheck(bytes32 id, address account, bytes calldata context) external;
}
