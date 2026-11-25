// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Vm} from "forge-std/Vm.sol";

import {DeterministicDeployer} from "../../script/lib/DeterministicDeployer.sol";

/// @notice Installs the Arachnid deterministic deployer at its canonical address.
library Create2FactoryFixture {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// Runtime code of the Arachnid deployer, read from Base Sepolia and Ethereum (identical).
    bytes internal constant RUNTIME =
        hex"7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3";

    function install() internal {
        VM.etch(DeterministicDeployer.FACTORY, RUNTIME);
    }
}
