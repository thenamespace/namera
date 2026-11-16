// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

/// @notice Policy that can be enabled but returns no data from its checks, like a proxy pointing at a broken
/// implementation.
contract MockSilentPolicy {
    function supportsInterface(bytes4) external pure returns (bool) {
        return true;
    }

    function initializeWithMultiplexer(address, bytes32, bytes calldata) external {}

    fallback() external {}
}
