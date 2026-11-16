// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {ContractSpec, Contracts} from "../../script/config/Contracts.sol";
import {DeterministicDeployer} from "../../script/lib/DeterministicDeployer.sol";
import {Create2FactoryFixture} from "../utils/Create2FactoryFixture.sol";
import {SmartSession} from "src/smart-sessions/SmartSession.sol";
import {ECDSASessionValidator} from "src/validators/ECDSASessionValidator.sol";

contract ContractsDeployer {
    function deploy(ContractSpec memory spec, bytes memory initcode) external returns (address) {
        return DeterministicDeployer.deploy(Contracts.salt(spec), initcode);
    }
}

/// @notice The deploy configuration: every managed contract deploys through the CREATE2 factory as the
/// contract it names, within the EIP-170 size limit.
contract ContractsConfigTest is Test {
    uint256 internal constant MAX_RUNTIME_SIZE = 24_576;

    ContractsDeployer internal deployer = new ContractsDeployer();

    function setUp() public {
        Create2FactoryFixture.install();
    }

    function test_labelsAreUnique() public pure {
        ContractSpec[] memory specs = Contracts.all();
        for (uint256 i; i < specs.length; ++i) {
            for (uint256 j = i + 1; j < specs.length; ++j) {
                assertNotEq(specs[i].label, specs[j].label);
            }
        }
    }

    function test_everyContractDeploysAtItsPredictedAddress() public {
        ContractSpec[] memory specs = Contracts.all();
        for (uint256 i; i < specs.length; ++i) {
            bytes memory initcode = vm.getCode(specs[i].artifact);
            address predicted =
                DeterministicDeployer.computeAddress(Contracts.salt(specs[i]), keccak256(initcode));

            address deployed = deployer.deploy(specs[i], initcode);

            assertEq(deployed, predicted, specs[i].label);
            assertGt(deployed.code.length, 0, specs[i].label);
            assertLe(deployed.code.length, MAX_RUNTIME_SIZE, specs[i].label);
        }
    }

    function test_artifactsAreTheSessionContracts() public {
        ContractSpec[] memory specs = Contracts.all();
        SmartSession smartSession =
            SmartSession(deployer.deploy(specs[0], vm.getCode(specs[0].artifact)));
        ECDSASessionValidator validator =
            ECDSASessionValidator(deployer.deploy(specs[1], vm.getCode(specs[1].artifact)));

        assertTrue(smartSession.isModuleType(1));
        assertTrue(validator.isModuleType(7));
    }
}
