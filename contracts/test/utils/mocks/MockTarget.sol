// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

/// @notice Call target that records what it received.
contract MockTarget {
    uint256 public value;
    uint256 public calls;
    uint256 public received;

    receive() external payable {
        received += msg.value;
    }

    function setValue(uint256 newValue) external payable {
        value = newValue;
        received += msg.value;
        ++calls;
    }
}
