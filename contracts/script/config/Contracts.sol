// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Vm} from "forge-std/Vm.sol";

/// @param artifact Foundry artifact identifier, e.g. "SessionValidator.sol:SessionValidator".
/// @param label Versioned name; the CREATE2 salt is `keccak256(label)`, e.g. "namera.session-validator.v1".
/// A new version gets a new label and therefore a new address. Never reuse a label for changed code.
/// Fields stay in alphabetical order: `vm.parseJson` decodes JSON objects into structs by sorted key.
struct ContractSpec {
    string artifact;
    string label;
}

/// @notice Every contract the deploy pipeline manages, in deployment order, read from
/// `script/config/contracts.json`. The repository tooling (`namera-dev contracts`) reads the same file,
/// so the list has a single source.
library Contracts {
    string internal constant CONFIG = "script/config/contracts.json";

    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function all() internal view returns (ContractSpec[] memory) {
        return abi.decode(VM.parseJson(VM.readFile(CONFIG), ".contracts"), (ContractSpec[]));
    }

    function salt(ContractSpec memory spec) internal pure returns (bytes32) {
        return keccak256(bytes(spec.label));
    }
}
