// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Script, console2} from "forge-std/Script.sol";

import {ContractSpec, Contracts} from "./config/Contracts.sol";
import {DeterministicDeployer} from "./lib/DeterministicDeployer.sol";
import {Preflight} from "./lib/Preflight.sol";

/// @notice Deploys every contract in `Contracts.all()` that is missing on the target chain. Safe to
/// re-run: deployed contracts are skipped. `pnpm contracts:record` turns the broadcast receipts
/// into `deployments/<chainId>.json`.
/// Usage: forge script script/Deploy.s.sol --rpc-url <url> --account <keystore> --broadcast
contract Deploy is Script {
    error PreflightFailed(uint256 chainId);

    function run() external {
        if (!Preflight.ok(Preflight.run())) revert PreflightFailed(block.chainid);

        ContractSpec[] memory specs = Contracts.all();

        vm.startBroadcast();
        for (uint256 i; i < specs.length; ++i) {
            address deployed = DeterministicDeployer.deploy(
                Contracts.salt(specs[i]), vm.getCode(specs[i].artifact)
            );
            console2.log(specs[i].label, deployed);
        }
        vm.stopBroadcast();
    }
}
