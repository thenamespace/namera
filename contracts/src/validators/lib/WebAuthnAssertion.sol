// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {P256} from "@openzeppelin/contracts/utils/cryptography/P256.sol";
import {Base64} from "solady/utils/Base64.sol";

/// @title WebAuthnAssertion
/// @notice Checks one WebAuthn assertion (a passkey's `navigator.credentials.get` answer) against a challenge and a
/// P-256 public key.
/// @dev Checks, following WebAuthn Level 3 §7.2 where they mean something on chain:
///      - `clientDataJSON` has `"type":"webauthn.get"` at `typeIndex`;
///      - `clientDataJSON` has `"challenge":"<base64url(challenge)>"` at `challengeIndex`, closing quote included;
///      - `authenticatorData` is at least 37 bytes, User Present is set, User Verified is set when required, and
///        Backup State is not set without Backup Eligible;
///      - its first 32 bytes equal `rpIdHash` when one is pinned;
///      - the P-256 signature over `sha256(authenticatorData ‖ sha256(clientDataJSON))` is valid with `0 < r < n` and
///        `0 < s <= n / 2`.
///      Origin, top origin, the signature counter and extensions are not checked: the authenticator and the browser
///      enforce the origin, and the rest needs state or has no on-chain meaning.
///      The P-256 backend is chosen by the caller, never probed: calling an empty `0x100` during validation breaks
///      ERC-7562, so the signer picks the precompile only where the chain has it.
library WebAuthnAssertion {
    address internal constant P256_PRECOMPILE = address(0x100);

    bytes1 internal constant FLAG_USER_PRESENT = 0x01;
    bytes1 internal constant FLAG_USER_VERIFIED = 0x04;
    bytes1 internal constant FLAG_BACKUP_ELIGIBLE = 0x08;
    bytes1 internal constant FLAG_BACKUP_STATE = 0x10;

    /// @dev `"type":"webauthn.get"`, 21 bytes.
    // The literal is exactly 21 bytes.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes21 internal constant TYPE_GET = bytes21('"type":"webauthn.get"');
    /// @dev `"challenge":"` (13 bytes) ‖ 43 base64url characters of a 32-byte challenge ‖ `"`.
    uint256 internal constant CHALLENGE_FIELD_LENGTH = 57;
    uint256 internal constant MIN_AUTHENTICATOR_DATA_LENGTH = 37;

    uint256 internal constant HALF_N =
        0x7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8;

    /// @notice A passkey's public key and the checks its assertions must pass.
    /// @param x The P-256 public key's x coordinate.
    /// @param y The P-256 public key's y coordinate.
    /// @param requireUserVerification Whether assertions must have the User Verified flag (biometrics or PIN).
    /// @param rpIdHash `sha256(rpId)` the assertions' authenticator data must start with, or zero for any.
    struct Passkey {
        bytes32 x;
        bytes32 y;
        bool requireUserVerification;
        bytes32 rpIdHash;
    }

    /// @notice Where one assertion's parts are in the calldata it was read from, and its P-256 signature.
    /// @param challengeIndex Where `"challenge":"` starts in `clientDataJSON`.
    /// @param typeIndex Where `"type":"webauthn.get"` starts in `clientDataJSON`.
    struct Assertion {
        bytes32 r;
        bytes32 s;
        uint256 challengeIndex;
        uint256 typeIndex;
        uint256 authenticatorDataStart;
        uint256 authenticatorDataEnd;
        uint256 clientDataJSONStart;
        uint256 clientDataJSONEnd;
    }

    /// @param challenge What the passkey signed: a user operation hash or a replay-safe ERC-1271 digest.
    /// @param data The calldata `assertion`'s offsets point into; they must be within it.
    /// @param precompile Whether to verify P-256 with the RIP-7212 / EIP-7951 precompile or in Solidity.
    /// @dev Never reverts on malformed input. The P-256 signature is checked even when an earlier check fails, so a
    /// well-formed stub signature costs what a real one does during gas estimation.
    function verify(
        bytes32 challenge,
        bytes calldata data,
        Assertion memory assertion,
        Passkey memory passkey,
        bool precompile
    ) internal view returns (bool) {
        bytes calldata authenticatorData =
            data[assertion.authenticatorDataStart:assertion.authenticatorDataEnd];
        if (authenticatorData.length < MIN_AUTHENTICATOR_DATA_LENGTH) return false;
        bytes calldata clientDataJSON =
            data[assertion.clientDataJSONStart:assertion.clientDataJSONEnd];
        bool fields = _hasType(clientDataJSON, assertion.typeIndex)
            && _hasChallenge(clientDataJSON, assertion.challengeIndex, challenge)
            && _hasFlags(authenticatorData[32], passkey.requireUserVerification)
            && (passkey.rpIdHash == bytes32(0)
                || bytes32(authenticatorData[0:32]) == passkey.rpIdHash);
        return _verifySignature(
            sha256(abi.encodePacked(authenticatorData, sha256(clientDataJSON))),
            assertion,
            passkey,
            precompile
        ) && fields;
    }

    /// @notice Whether `(x, y)` is a point of the P-256 curve with coordinates below the field modulus.
    function isValidPublicKey(bytes32 x, bytes32 y) internal pure returns (bool) {
        return P256.isValidPublicKey(x, y);
    }

    function _hasType(bytes calldata clientDataJSON, uint256 typeIndex)
        private
        pure
        returns (bool)
    {
        if (clientDataJSON.length < 21 || typeIndex > clientDataJSON.length - 21) {
            return false;
        }
        return bytes21(clientDataJSON[typeIndex:typeIndex + 21]) == TYPE_GET;
    }

    function _hasChallenge(bytes calldata clientDataJSON, uint256 challengeIndex, bytes32 challenge)
        private
        pure
        returns (bool)
    {
        if (
            clientDataJSON.length < CHALLENGE_FIELD_LENGTH
                || challengeIndex > clientDataJSON.length - CHALLENGE_FIELD_LENGTH
        ) return false;
        bytes memory expected = abi.encodePacked(
            '"challenge":"', Base64.encode(abi.encodePacked(challenge), true, true), '"'
        );
        return keccak256(clientDataJSON[challengeIndex:challengeIndex + CHALLENGE_FIELD_LENGTH])
            == keccak256(expected);
    }

    function _hasFlags(bytes1 flags, bool requireUserVerification) private pure returns (bool) {
        if (flags & FLAG_USER_PRESENT == 0) return false;
        if (requireUserVerification && flags & FLAG_USER_VERIFIED == 0) return false;
        return flags & FLAG_BACKUP_STATE == 0 || flags & FLAG_BACKUP_ELIGIBLE != 0;
    }

    function _verifySignature(
        bytes32 message,
        Assertion memory assertion,
        Passkey memory passkey,
        bool precompile
    ) private view returns (bool) {
        return precompile
            ? _verifyPrecompile(message, assertion.r, assertion.s, passkey.x, passkey.y)
            : P256.verifySolidity(message, assertion.r, assertion.s, passkey.x, passkey.y);
    }

    /// @dev Valid only if the call succeeds and returns exactly the word 1: the precompile returns nothing for an
    /// invalid signature, some implementations return the word 0, and an account without code at `0x100` returns
    /// nothing.
    function _verifyPrecompile(bytes32 message, bytes32 r, bytes32 s, bytes32 x, bytes32 y)
        private
        view
        returns (bool valid)
    {
        // The precompile rejects r and s outside [1, n) itself, but accepts high s.
        if (uint256(s) > HALF_N) return false;
        (bool success, bytes memory result) =
            P256_PRECOMPILE.staticcall(abi.encode(message, r, s, x, y));
        return success && result.length == 32 && abi.decode(result, (uint256)) == 1;
    }
}
