// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Script, console2} from "forge-std/Script.sol";

import {ContractSpec, Contracts} from "./config/Contracts.sol";
import {DeterministicDeployer} from "./lib/DeterministicDeployer.sol";
import {Preflight} from "./lib/Preflight.sol";

/// @notice Read-only report for one chain: pre-flight checks and which contracts are deployed.
/// Usage: forge script script/Status.s.sol --rpc-url <url>
contract Status is Script {
    function run() external {
        Preflight.Result memory checks = Preflight.run();

        console2.log("chain", block.chainid);
        console2.log("  create2 factory   ", checks.factory);
        console2.log("  entrypoint v0.7   ", checks.entryPoint);
        console2.log("  cancun opcodes    ", checks.cancun);

        ContractSpec[] memory specs = Contracts.all();
        uint256 missing;
        for (uint256 i; i < specs.length; ++i) {
            bytes32 initcodeHash = keccak256(vm.getCode(specs[i].artifact));
            address target =
                DeterministicDeployer.computeAddress(Contracts.salt(specs[i]), initcodeHash);
            bool deployed = target.code.length != 0;
            if (!deployed) ++missing;
            console2.log(string.concat("  ", specs[i].label), target, deployed);
        }

        console2.log("  contracts missing ", missing, "of", specs.length);
        console2.log("  ready             ", Preflight.ok(checks));
    }
}
