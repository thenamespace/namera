// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ExecutionPolicyBase} from "src/hooks/ExecutionPolicyBase.sol";

/// @notice An execution policy built on `ExecutionPolicyBase` that records its calls and, per configuration, reverts
/// in `preCheck` or `postCheck`. `preCheck` returns the operation's `execData` hash as context; `postCheck` requires it
/// back unchanged.
contract MockExecutionPolicy is ExecutionPolicyBase {
    enum Mode {
        Pass,
        RevertPre,
        RevertPost
    }

    error Rejected(bytes32 id, address account);
    error WrongContext();

    mapping(bytes32 id => mapping(address multiplexer => mapping(address account => Mode))) public
        modes;
    mapping(address account => uint256) public preChecks;
    mapping(address account => uint256) public postChecks;
    bytes public lastExecData;

    /// @param initData `abi.encode(Mode)`.
    function _configure(bytes32 id, address multiplexer, address account, bytes calldata initData)
        internal
        override
    {
        modes[id][multiplexer][account] = abi.decode(initData, (Mode));
    }

    function _preCheck(bytes32 id, address multiplexer, address account, bytes calldata execData)
        internal
        override
        returns (bytes memory)
    {
        if (modes[id][multiplexer][account] == Mode.RevertPre) revert Rejected(id, account);
        preChecks[account]++;
        lastExecData = execData;
        return abi.encode(keccak256(execData));
    }

    function _postCheck(bytes32 id, address multiplexer, address account, bytes calldata context)
        internal
        override
    {
        if (modes[id][multiplexer][account] == Mode.RevertPost) revert Rejected(id, account);
        if (abi.decode(context, (bytes32)) != keccak256(lastExecData)) revert WrongContext();
        postChecks[account]++;
    }
}
