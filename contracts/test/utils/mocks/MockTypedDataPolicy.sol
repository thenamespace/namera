// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ConfigId} from "src/smart-sessions/DataTypes.sol";
import {
    I1271Policy,
    I1271TypedDataPolicy,
    IPolicy
} from "src/smart-sessions/interfaces/IPolicy.sol";

/// @notice ERC-1271 typed-data policy that accepts exactly the request it was configured with, so tests can see what
/// Smart Sessions passes: `initData` is `abi.encode(appDomainSeparator, contentsData, policyData)`. Its legacy hook
/// always refuses, so a test also sees which hook ran.
contract MockTypedDataPolicy is I1271TypedDataPolicy {
    mapping(ConfigId => mapping(address multiplexer => mapping(address account => bytes32))) public
        expected;

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IPolicy).interfaceId
            || interfaceId == type(I1271Policy).interfaceId
            || interfaceId == type(I1271TypedDataPolicy).interfaceId;
    }

    function initializeWithMultiplexer(address account, ConfigId configId, bytes calldata initData)
        external
    {
        expected[configId][msg.sender][account] = keccak256(initData);
        emit IPolicy.PolicySet(configId, msg.sender, account);
    }

    function check1271TypedData(
        ConfigId id,
        address,
        address account,
        bytes32 appDomainSeparator,
        bytes calldata contentsData,
        bytes calldata policyData
    ) external view returns (bool) {
        return keccak256(abi.encode(appDomainSeparator, contentsData, policyData))
            == expected[id][msg.sender][account];
    }

    function check1271SignedAction(ConfigId, address, address, bytes32, bytes calldata)
        external
        pure
        returns (bool)
    {
        return false;
    }
}
