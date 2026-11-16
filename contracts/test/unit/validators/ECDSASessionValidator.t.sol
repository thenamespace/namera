// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "solady/utils/ECDSA.sol";

import {ECDSASessionValidator} from "src/validators/ECDSASessionValidator.sol";

contract ECDSASessionValidatorTest is Test {
    bytes32 internal constant HASH = keccak256("user operation hash");

    ECDSASessionValidator internal validator;
    uint256[] internal keys;
    address[] internal signers;

    function setUp() public {
        validator = new ECDSASessionValidator();
        for (uint256 i; i < 3; ++i) {
            (address signer, uint256 key) = makeAddrAndKey(string.concat("signer", vm.toString(i)));
            keys.push(key);
            signers.push(signer);
        }
        _sortByAddress();
    }

    function test_isStatelessValidatorModule() public view {
        assertTrue(validator.isModuleType(7));
        assertFalse(validator.isModuleType(1));
    }

    function test_oneOfOne_isValid() public view {
        bytes memory config = _config(1, _signers(1));

        assertTrue(validator.validateSignatureWithData(HASH, _sign(0), config));
    }

    function test_twoOfThree_isValid() public view {
        bytes memory signature = abi.encodePacked(_sign(0), _sign(2));

        assertTrue(validator.validateSignatureWithData(HASH, signature, _config(2, signers)));
    }

    function test_signaturesOutOfOrder_areInvalid() public view {
        bytes memory signature = abi.encodePacked(_sign(2), _sign(0));

        assertFalse(validator.validateSignatureWithData(HASH, signature, _config(2, signers)));
    }

    function test_duplicateSigner_isInvalid() public view {
        bytes memory signature = abi.encodePacked(_sign(1), _sign(1));

        assertFalse(validator.validateSignatureWithData(HASH, signature, _config(2, signers)));
    }

    function test_signerNotInConfig_isInvalid() public {
        (, uint256 outsider) = makeAddrAndKey("outsider");
        bytes memory signature = _signWith(outsider, HASH);

        assertFalse(validator.validateSignatureWithData(HASH, signature, _config(1, signers)));
    }

    function test_signatureOverRawHash_isInvalid() public view {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(keys[0], HASH);

        assertFalse(
            validator.validateSignatureWithData(
                HASH, abi.encodePacked(r, s, v), _config(1, signers)
            )
        );
    }

    function test_signatureForOtherHash_isInvalid() public view {
        bytes memory signature = _signWith(keys[0], keccak256("other"));

        assertFalse(validator.validateSignatureWithData(HASH, signature, _config(1, signers)));
    }

    function test_zeroThreshold_isInvalid() public view {
        assertFalse(validator.validateSignatureWithData(HASH, "", _config(0, signers)));
    }

    function test_thresholdAboveSignerCount_isInvalid() public view {
        bytes memory signature = abi.encodePacked(_sign(0), _sign(1));

        assertFalse(validator.validateSignatureWithData(HASH, signature, _config(2, _signers(1))));
    }

    function test_wrongSignatureLength_isInvalid() public view {
        bytes memory signature = abi.encodePacked(_sign(0), bytes1(0));

        assertFalse(validator.validateSignatureWithData(HASH, signature, _config(1, signers)));
    }

    function test_malformedSignature_isInvalid() public view {
        assertFalse(validator.validateSignatureWithData(HASH, new bytes(65), _config(1, signers)));
    }

    function testFuzz_onlyTheSignedHashValidates(bytes32 hash, bytes32 otherHash) public view {
        vm.assume(hash != otherHash);
        bytes memory signature = _signWith(keys[0], hash);

        assertTrue(validator.validateSignatureWithData(hash, signature, _config(1, signers)));
        assertFalse(validator.validateSignatureWithData(otherHash, signature, _config(1, signers)));
    }

    function _sign(uint256 index) internal view returns (bytes memory) {
        return _signWith(keys[index], HASH);
    }

    function _signWith(uint256 key, bytes32 hash) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, ECDSA.toEthSignedMessageHash(hash));
        return abi.encodePacked(r, s, v);
    }

    function _config(uint256 threshold, address[] memory configSigners)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(threshold, configSigners);
    }

    function _signers(uint256 count) internal view returns (address[] memory subset) {
        subset = new address[](count);
        for (uint256 i; i < count; ++i) {
            subset[i] = signers[i];
        }
    }

    /// @dev Keeps `signers` ascending and `keys` aligned with it.
    function _sortByAddress() internal {
        for (uint256 i; i < signers.length; ++i) {
            for (uint256 j = i + 1; j < signers.length; ++j) {
                if (signers[j] < signers[i]) {
                    (signers[i], signers[j]) = (signers[j], signers[i]);
                    (keys[i], keys[j]) = (keys[j], keys[i]);
                }
            }
        }
    }
}
