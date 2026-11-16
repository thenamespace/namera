// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {DeterministicDeployer} from "../../script/lib/DeterministicDeployer.sol";

contract Deployable {
    uint256 public constant VALUE = 42;
}

contract DeployerHarness {
    function deploy(bytes32 salt, bytes memory initcode) external returns (address) {
        return DeterministicDeployer.deploy(salt, initcode);
    }
}

contract DeterministicDeployerTest is Test {
    /// Runtime code of the Arachnid deployer, read from Base Sepolia and Ethereum (identical).
    bytes internal constant FACTORY_RUNTIME =
        hex"7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3";

    DeployerHarness internal harness = new DeployerHarness();

    function setUp() public {
        vm.etch(DeterministicDeployer.FACTORY, FACTORY_RUNTIME);
    }

    function test_deploy_landsAtComputedAddress(bytes32 salt) public {
        bytes memory initcode = type(Deployable).creationCode;

        address deployed = harness.deploy(salt, initcode);

        assertEq(
            deployed,
            vm.computeCreate2Address(salt, keccak256(initcode), DeterministicDeployer.FACTORY)
        );
        assertEq(Deployable(deployed).VALUE(), 42);
    }

    function test_deploy_isIdempotent() public {
        bytes memory initcode = type(Deployable).creationCode;

        address first = harness.deploy(bytes32(0), initcode);
        address second = harness.deploy(bytes32(0), initcode);

        assertEq(first, second);
    }

    function test_deploy_revertsWithoutFactory() public {
        vm.etch(DeterministicDeployer.FACTORY, "");

        vm.expectRevert(
            abi.encodeWithSelector(DeterministicDeployer.DeploymentFailed.selector, bytes32(0))
        );
        harness.deploy(bytes32(0), type(Deployable).creationCode);
    }
}
