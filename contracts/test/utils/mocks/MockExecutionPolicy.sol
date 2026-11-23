// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {IExecutionPolicy} from "src/hooks/interfaces/IExecutionPolicy.sol";
import {IPolicy} from "src/policies/interfaces/IPolicy.sol";

/// @notice An execution policy that records its calls and, per configuration, reverts in `preCheck` or `postCheck`.
/// `preCheck` returns the operation's `execData` hash as context; `postCheck` requires it back unchanged.
contract MockExecutionPolicy is IExecutionPolicy {
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

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IExecutionPolicy).interfaceId
            || interfaceId == type(IPolicy).interfaceId;
    }

    /// @param initData `abi.encode(Mode)`.
    function initializeWithMultiplexer(address account, bytes32 configId, bytes calldata initData)
        external
    {
        modes[configId][msg.sender][account] = abi.decode(initData, (Mode));
        emit PolicySet(configId, msg.sender, account);
    }

    function preCheck(bytes32 id, address account, bytes calldata execData)
        external
        returns (bytes memory)
    {
        if (modes[id][msg.sender][account] == Mode.RevertPre) revert Rejected(id, account);
        preChecks[account]++;
        lastExecData = execData;
        return abi.encode(keccak256(execData));
    }

    function postCheck(bytes32 id, address account, bytes calldata context) external {
        if (modes[id][msg.sender][account] == Mode.RevertPost) revert Rejected(id, account);
        if (abi.decode(context, (bytes32)) != keccak256(lastExecData)) revert WrongContext();
        postChecks[account]++;
    }
}
