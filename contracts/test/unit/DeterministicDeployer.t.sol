// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {DeterministicDeployer} from "../../script/lib/DeterministicDeployer.sol";
import {Create2FactoryFixture} from "../utils/Create2FactoryFixture.sol";

contract Deployable {
    uint256 public constant VALUE = 42;
}

contract DeployerHarness {
    function deploy(bytes32 salt, bytes memory initcode) external returns (address) {
        return DeterministicDeployer.deploy(salt, initcode);
    }
}

contract DeterministicDeployerTest is Test {
    DeployerHarness internal harness = new DeployerHarness();

    function setUp() public {
        Create2FactoryFixture.install();
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
