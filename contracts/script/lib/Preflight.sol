// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Vm} from "forge-std/Vm.sol";

import {DeterministicDeployer} from "./DeterministicDeployer.sol";

/// @notice Checks a chain can host Namera's contracts before anything is deployed.
library Preflight {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant ENTRY_POINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    /// Creation code running PUSH0, MCOPY, TSTORE and TLOAD, then STOP. Succeeds only on Cancun+.
    string private constant CANCUN_PROBE = "0x5f5f5f5e5f5f5d5f5c5000";
    /// Creation code running INVALID. Must fail, proving the probe can tell success from failure.
    string private constant INVALID_PROBE = "0xfe";

    struct Result {
        bool factory;
        bool entryPoint;
        bool cancun;
    }

    function run() internal returns (Result memory result) {
        result.factory = DeterministicDeployer.FACTORY.code.length != 0;
        result.entryPoint = ENTRY_POINT_V07.code.length != 0;
        // Opcode support is checked on the real node via eth_call: the local fork simulation runs
        // Foundry's EVM with the configured evm_version, not the chain's.
        result.cancun = executes(CANCUN_PROBE) && !executes(INVALID_PROBE);
    }

    function ok(Result memory result) internal pure returns (bool) {
        return result.factory && result.entryPoint && result.cancun;
    }

    function executes(string memory creationCode) private returns (bool) {
        string memory params = string.concat('[{"data":"', creationCode, '"},"latest"]');
        try VM.rpc("eth_call", params) returns (bytes memory) {
            return true;
        } catch {
            return false;
        }
    }
}
