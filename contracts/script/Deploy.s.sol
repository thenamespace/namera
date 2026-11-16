// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Script, console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";

import {ContractSpec, Contracts} from "./config/Contracts.sol";
import {DeterministicDeployer} from "./lib/DeterministicDeployer.sol";
import {Preflight} from "./lib/Preflight.sol";

/// @notice Deploys every contract in `Contracts.all()` that is missing on the target chain. Safe to
/// re-run: deployed contracts are skipped. Writes `deployments/<chainId>.json` when broadcasting.
/// Usage: forge script script/Deploy.s.sol --rpc-url <url> --account <keystore> --broadcast
contract Deploy is Script {
    error PreflightFailed(uint256 chainId);

    function run() external {
        if (!Preflight.ok(Preflight.run())) revert PreflightFailed(block.chainid);

        ContractSpec[] memory specs = Contracts.all();
        string memory manifest = "manifest";
        string memory json = vm.serializeUint(manifest, "chainId", block.chainid);

        vm.startBroadcast();
        for (uint256 i; i < specs.length; ++i) {
            bytes memory initcode = vm.getCode(specs[i].artifact);
            bytes32 salt = Contracts.salt(specs[i]);
            address deployed = DeterministicDeployer.deploy(salt, initcode);
            console2.log(specs[i].label, deployed);
            json = vm.serializeString(
                manifest, specs[i].label, entry(specs[i], deployed, salt, initcode)
            );
        }
        vm.stopBroadcast();

        if (vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) {
            vm.writeJson(json, string.concat("deployments/", vm.toString(block.chainid), ".json"));
        }
    }

    function entry(ContractSpec memory spec, address deployed, bytes32 salt, bytes memory initcode)
        private
        returns (string memory)
    {
        string memory key = spec.label;
        vm.serializeString(key, "artifact", spec.artifact);
        vm.serializeAddress(key, "address", deployed);
        vm.serializeBytes32(key, "salt", salt);
        return vm.serializeBytes32(key, "initcodeHash", keccak256(initcode));
    }
}
