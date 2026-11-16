// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

/// @param artifact Foundry artifact identifier, e.g. "SessionValidator.sol:SessionValidator".
/// @param label Versioned name; the CREATE2 salt is `keccak256(label)`, e.g. "namera.session-validator.v1".
/// A new version gets a new label and therefore a new address. Never reuse a label for changed code.
struct ContractSpec {
    string artifact;
    string label;
}

/// @notice Every contract the deploy pipeline manages, in deployment order.
library Contracts {
    function all() internal pure returns (ContractSpec[] memory specs) {
        specs = new ContractSpec[](0);
    }

    function salt(ContractSpec memory spec) internal pure returns (bytes32) {
        return keccak256(bytes(spec.label));
    }
}
