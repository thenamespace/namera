// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Vm} from "forge-std/Vm.sol";

/// @notice Installs deployed smart account contracts from test/fixtures/accounts/<name>@<address>.hex at
/// their canonical addresses, so real Kernel, Nexus and Safe7579 accounts run in local tests. Refresh with
/// `pnpm fixtures:accounts`.
library AccountFixtures {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    string internal constant DIR = "test/fixtures/accounts";

    function install() internal {
        Vm.DirEntry[] memory entries = VM.readDir(DIR);
        for (uint256 i; i < entries.length; ++i) {
            if (entries[i].isDir) continue;
            string[] memory path = VM.split(entries[i].path, "/");
            string[] memory nameAndAddress =
                VM.split(VM.replace(path[path.length - 1], ".hex", ""), "@");
            address target = VM.parseAddress(nameAndAddress[1]);
            VM.etch(target, VM.parseBytes(VM.trim(VM.readFile(entries[i].path))));
            VM.label(target, nameAndAddress[0]);
        }
    }
}
