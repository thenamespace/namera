// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "solady/utils/ECDSA.sol";

import {ECDSASessionValidator} from "src/validators/ECDSASessionValidator.sol";

/// @notice The session key configs the SDK encodes (`test/fixtures/session-keys.json`, shared with the SDK's tests)
/// are what `ECDSASessionValidator` decodes, and `threshold` signatures by the first signers, in ascending order,
/// validate under them.
contract SessionKeyVectorsTest is Test {
    ECDSASessionValidator internal validator = new ECDSASessionValidator();

    // anvil's development keys for the vector signers.
    uint256[3] internal keys = [
        0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d,
        0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a,
        0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
    ];

    function test_vectorsMatchTheValidatorsEncodingAndValidate() public view {
        string memory json = vm.readFile("test/fixtures/session-keys.json");
        uint256 count;
        while (vm.keyExistsJson(json, string.concat(".vectors[", vm.toString(count), "]"))) ++count;
        assertEq(count, 3);

        bytes32 hash = keccak256("session key vectors");
        for (uint256 i; i < count; ++i) {
            string memory at = string.concat(".vectors[", vm.toString(i), "]");
            uint256 threshold = vm.parseJsonUint(json, string.concat(at, ".threshold"));
            address[] memory signers = vm.parseJsonAddressArray(json, string.concat(at, ".signers"));
            bytes memory config = vm.parseJsonBytes(json, string.concat(at, ".config"));

            assertEq(abi.encode(threshold, signers), config);

            bytes memory signature;
            for (uint256 j; j < threshold; ++j) {
                (uint8 v, bytes32 r, bytes32 s) =
                    vm.sign(_keyOf(signers[j]), ECDSA.toEthSignedMessageHash(hash));
                signature = abi.encodePacked(signature, r, s, v);
            }
            assertTrue(validator.validateSignatureWithData(hash, signature, config));
        }
    }

    function _keyOf(address signer) internal view returns (uint256) {
        for (uint256 i; i < keys.length; ++i) {
            if (vm.addr(keys[i]) == signer) return keys[i];
        }
        revert("no key for signer");
    }
}
