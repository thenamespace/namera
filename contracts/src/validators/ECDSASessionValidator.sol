// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ECDSA} from "solady/utils/ECDSA.sol";

/// @title ECDSASessionValidator
/// @notice Stateless (ERC-7579 module type 7) k-of-n ECDSA validator for Smart Sessions session keys.
/// Smart Sessions only calls `isModuleType` and `validateSignatureWithData`.
/// @dev Smart Sessions stores the config per session and passes it to `validateSignatureWithData`:
///      - `data` = `abi.encode(uint256 threshold, address[] signers)`, with `0 < threshold <= signers.length`.
///      - `signature` = `threshold` concatenated 65-byte `r ‖ s ‖ v` signatures over the EIP-191 message
///        `toEthSignedMessageHash(hash)`, ordered by strictly increasing signer address.
///      Strict ordering rejects duplicate signers, including malleable variants of one signature.
/// Implements the ISessionValidator ABI without inheriting it, so this contract stays Apache-2.0 (the
/// interface file is LGPL-3.0).
// slither-disable-next-line missing-inheritance
contract ECDSASessionValidator {
    uint256 internal constant MODULE_TYPE_STATELESS_VALIDATOR = 7;
    uint256 internal constant SIGNATURE_LENGTH = 65;

    function validateSignatureWithData(bytes32 hash, bytes calldata signature, bytes calldata data)
        external
        view
        returns (bool)
    {
        (uint256 threshold, address[] memory signers) = abi.decode(data, (uint256, address[]));
        if (threshold == 0 || threshold > signers.length) return false;
        if (signature.length != threshold * SIGNATURE_LENGTH) return false;

        bytes32 digest = ECDSA.toEthSignedMessageHash(hash);
        address previous = address(0);
        for (uint256 i; i < threshold; ++i) {
            bytes calldata sig = signature[i * SIGNATURE_LENGTH:(i + 1) * SIGNATURE_LENGTH];
            address recovered = ECDSA.tryRecoverCalldata(digest, sig);
            // Also rejects a failed recovery (address(0)) for the first signature.
            if (recovered <= previous || !_contains(signers, recovered)) return false;
            previous = recovered;
        }
        return true;
    }

    function isModuleType(uint256 moduleTypeId) external pure returns (bool) {
        return moduleTypeId == MODULE_TYPE_STATELESS_VALIDATOR;
    }

    function _contains(address[] memory signers, address signer) private pure returns (bool) {
        uint256 length = signers.length;
        for (uint256 i; i < length; ++i) {
            if (signers[i] == signer) return true;
        }
        return false;
    }
}
