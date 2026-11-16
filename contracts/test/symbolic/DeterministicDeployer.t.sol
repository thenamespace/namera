// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {DeterministicDeployer} from "../../script/lib/DeterministicDeployer.sol";

/// @notice Halmos proofs (`check_` prefix). Run with `pnpm symbolic`.
contract DeterministicDeployerSymbolicTest is Test {
    /// Proves the library matches an independent assembly implementation of the EIP-1014 formula
    /// for every salt and initcode hash. (forge-std's helper is a cheatcode Halmos does not support.)
    function check_computeAddress_matchesEip1014(bytes32 salt, bytes32 initcodeHash) public pure {
        address factory = DeterministicDeployer.FACTORY;
        address expected;
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            mstore8(ptr, 0xff)
            mstore(add(ptr, 0x01), shl(96, factory))
            mstore(add(ptr, 0x15), salt)
            mstore(add(ptr, 0x35), initcodeHash)
            expected := and(keccak256(ptr, 0x55), 0xffffffffffffffffffffffffffffffffffffffff)
        }

        assertEq(DeterministicDeployer.computeAddress(salt, initcodeHash), expected);
    }
}
