// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC20} from "solady/tokens/ERC20.sol";

/// @notice A plain ERC-20 with open minting, for policy tests.
contract MockERC20 is ERC20 {
    function name() public pure override returns (string memory) {
        return "Mock";
    }

    function symbol() public pure override returns (string memory) {
        return "MOCK";
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
