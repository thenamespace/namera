// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Vm} from "forge-std/Vm.sol";

/// @notice Installs deployed smart account contracts (test/fixtures/accounts.json) at their canonical
/// addresses, so real Kernel, Nexus and Safe7579 accounts run in local tests. Refresh with
/// `pnpm fixtures:accounts`.
library AccountFixtures {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    struct Fixture {
        address addr;
        bytes code;
        string name;
    }

    function install() internal {
        string memory json = VM.readFile("test/fixtures/accounts.json");
        Fixture[] memory fixtures = abi.decode(VM.parseJson(json, ".contracts"), (Fixture[]));
        for (uint256 i; i < fixtures.length; ++i) {
            VM.etch(fixtures[i].addr, fixtures[i].code);
            VM.label(fixtures[i].addr, fixtures[i].name);
        }
    }
}
