// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Vm} from "forge-std/Vm.sol";

/// @notice Installs the deployed contracts a real Kernel 3.3 account needs at their canonical addresses: EntryPoint
/// v0.7 and its sender creator, Kernel 3.3's factory, implementation and factory staker, and Kernel's ECDSA validator.
/// Each is read from its `test/fixtures/accounts` file, named after the contract and its address. Refresh with
/// `pnpm fixtures:accounts`.
library AccountFixtures {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    string internal constant DIR = "test/fixtures/accounts/";

    function install() internal {
        string[6] memory fixtures = [
            "entrypoint-0.7@0x0000000071727De22E5E9d8BAf0edAc6f37da032",
            "entrypoint-0.7-sender-creator@0xEFC2c1444eBCC4Db75e7613d20C6a62fF67A167C",
            "kernel-3.3-factory@0x2577507b78c2008Ff367261CB6285d44ba5eF2E9",
            "kernel-3.3-implementation@0xd6CEDDe84be40893d153Be9d467CD6aD37875b28",
            "kernel-factory-staker@0xd703aaE79538628d27099B8c4f621bE4CCd142d5",
            "kernel-ecdsa-validator@0x845ADb2C711129d4f3966735eD98a9F09fC4cE57"
        ];
        for (uint256 i; i < fixtures.length; ++i) {
            string[] memory nameAndAddress = VM.split(fixtures[i], "@");
            address target = VM.parseAddress(nameAndAddress[1]);
            string memory path = string.concat(DIR, fixtures[i], ".hex");
            VM.etch(target, VM.parseBytes(VM.trim(VM.readFile(path))));
            VM.label(target, nameAndAddress[0]);
        }
    }
}
