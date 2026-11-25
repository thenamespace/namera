// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

/// @notice CREATE2 deployments through the Arachnid deterministic deployer, which exists at the same
/// address on every launch chain. The resulting address depends only on the salt and the initcode,
/// so it commits to the exact bytecode and is identical across chains.
library DeterministicDeployer {
    address internal constant FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    error DeploymentFailed(bytes32 salt);

    function computeAddress(bytes32 salt, bytes32 initcodeHash) internal pure returns (address) {
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), FACTORY, salt, initcodeHash))))
        );
    }

    /// @dev Idempotent: returns the existing address when the contract is already deployed. Code at
    /// the CREATE2 address can only come from this salt and initcode, so existing code is correct.
    function deploy(bytes32 salt, bytes memory initcode) internal returns (address deployed) {
        deployed = computeAddress(salt, keccak256(initcode));
        if (deployed.code.length != 0) return deployed;

        (bool ok,) = FACTORY.call(abi.encodePacked(salt, initcode));
        if (!ok || deployed.code.length == 0) revert DeploymentFailed(salt);
    }
}
