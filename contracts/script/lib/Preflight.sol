// SPDX-License-Identifier: Apache-2.0
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

    /// The P-256 verifier WebAuthnValidator calls when a signature picks the precompile backend (RIP-7212 /
    /// EIP-7951), and RIP-7212's test vector `hash ‖ r ‖ s ‖ x ‖ y`, valid; the same with the last byte of `s`
    /// changed is invalid.
    string private constant P256_PRECOMPILE = "0x0000000000000000000000000000000000000100";
    string private constant P256_VALID =
        "0xbb5a52f42f9c9261ed4361f59422a1e30036e7c32b270c8807a419feca6050232ba3a8be6b94d5ec80a6d9d1190a436effe50d85a1eee859b8cc6af9bd5c2e184cd60b855d442f5b3c7b11eb6c4e0ae7525fe710fab9aa7c77a67f79e6fadd762927b10512bae3eddcfe467828128bad2903269919f7086069c8c4df6c732838c7787964eaac00e5921fb1498a60f4606766b3d9685001558d1a974e7341513e";
    string private constant P256_INVALID =
        "0xbb5a52f42f9c9261ed4361f59422a1e30036e7c32b270c8807a419feca6050232ba3a8be6b94d5ec80a6d9d1190a436effe50d85a1eee859b8cc6af9bd5c2e184cd60b855d442f5b3c7b11eb6c4e0ae7525fe710fab9aa7c77a67f79e6fadd772927b10512bae3eddcfe467828128bad2903269919f7086069c8c4df6c732838c7787964eaac00e5921fb1498a60f4606766b3d9685001558d1a974e7341513e";

    struct Result {
        bool factory;
        bool entryPoint;
        bool cancun;
        /// The P-256 precompile verifies (passkeys then use it; without it they verify in Solidity).
        bool p256;
        /// Whatever answers at `0x100` refuses an invalid signature, so a passkey signature that picks the
        /// precompile backend can't be forged. False would let anyone sign as any passkey on the chain.
        bool p256Safe;
    }

    function run() internal returns (Result memory result) {
        result.factory = DeterministicDeployer.FACTORY.code.length != 0;
        result.entryPoint = ENTRY_POINT_V07.code.length != 0;
        // Opcode support is checked on the real node via eth_call: the local fork simulation runs
        // Foundry's EVM with the configured evm_version, not the chain's.
        result.cancun = executes(CANCUN_PROBE) && !executes(INVALID_PROBE);
        result.p256 = verifiesP256(P256_VALID);
        result.p256Safe = !verifiesP256(P256_INVALID);
    }

    function ok(Result memory result) internal pure returns (bool) {
        return result.factory && result.entryPoint && result.cancun && result.p256Safe;
    }

    /// Whether `0x100` answers the word 1 for `input` on the real node.
    function verifiesP256(string memory input) private returns (bool) {
        string memory params =
            string.concat('[{"to":"', P256_PRECOMPILE, '","data":"', input, '"},"latest"]');
        try VM.rpc("eth_call", params) returns (bytes memory output) {
            return output.length == 32 && abi.decode(output, (uint256)) == 1;
        } catch {
            return false;
        }
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
