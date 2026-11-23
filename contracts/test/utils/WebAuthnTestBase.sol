// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {P256} from "@openzeppelin/contracts/utils/cryptography/P256.sol";
import {Test} from "forge-std/Test.sol";
import {Base64} from "solady/utils/Base64.sol";

import {WebAuthnValidator} from "src/validators/WebAuthnValidator.sol";
import {WebAuthnAssertion} from "src/validators/lib/WebAuthnAssertion.sol";

/// @notice Builds passkeys and WebAuthn assertions the way an authenticator does: `clientDataJSON` with the
/// base64url challenge, authenticator data with flags, and a low-s P-256 signature over
/// `sha256(authenticatorData ‖ sha256(clientDataJSON))`.
abstract contract WebAuthnTestBase is Test {
    struct TestPasskey {
        uint256 privateKey;
        bytes32 x;
        bytes32 y;
        bytes32 id;
    }

    struct Parts {
        bytes32 id;
        bytes32 r;
        bytes32 s;
        uint16 challengeIndex;
        uint16 typeIndex;
        bytes authenticatorData;
        bytes clientDataJSON;
    }

    uint8 internal constant MODE_DIRECT = 0;
    uint8 internal constant MODE_MULTICHAIN = 1;
    uint8 internal constant BACKEND_PRECOMPILE = 0;
    uint8 internal constant BACKEND_SOLIDITY = 1;

    bytes1 internal constant FLAGS_UP_UV = 0x05;
    bytes32 internal constant RP_ID_HASH = sha256("namera.test");

    uint256 internal constant HALF_N = P256.N / 2;

    function _passkey(string memory name) internal pure returns (TestPasskey memory passkey) {
        passkey.privateKey = uint256(keccak256(bytes(name))) % (P256.N - 1) + 1;
        (uint256 x, uint256 y) = vm.publicKeyP256(passkey.privateKey);
        passkey.x = bytes32(x);
        passkey.y = bytes32(y);
        passkey.id = keccak256(abi.encode(passkey.x, passkey.y));
    }

    function _config(TestPasskey memory passkey)
        internal
        pure
        returns (WebAuthnAssertion.Passkey memory)
    {
        return WebAuthnAssertion.Passkey({
            x: passkey.x, y: passkey.y, requireUserVerification: true, rpIdHash: bytes32(0)
        });
    }

    function _installData(uint256 threshold, TestPasskey[] memory passkeys)
        internal
        pure
        returns (bytes memory)
    {
        WebAuthnAssertion.Passkey[] memory configs =
            new WebAuthnAssertion.Passkey[](passkeys.length);
        for (uint256 i; i < passkeys.length; ++i) {
            configs[i] = _config(passkeys[i]);
        }
        return abi.encode(threshold, configs);
    }

    function _list(TestPasskey memory a) internal pure returns (TestPasskey[] memory list) {
        list = new TestPasskey[](1);
        list[0] = a;
    }

    function _list(TestPasskey memory a, TestPasskey memory b)
        internal
        pure
        returns (TestPasskey[] memory list)
    {
        list = new TestPasskey[](2);
        list[0] = a;
        list[1] = b;
    }

    function _list(TestPasskey memory a, TestPasskey memory b, TestPasskey memory c)
        internal
        pure
        returns (TestPasskey[] memory list)
    {
        list = new TestPasskey[](3);
        list[0] = a;
        list[1] = b;
        list[2] = c;
    }

    function _challengeField(bytes32 challenge) internal pure returns (bytes memory) {
        return abi.encodePacked(
            '"challenge":"', Base64.encode(abi.encodePacked(challenge), true, true), '"'
        );
    }

    /// @dev Chrome's layout: type first, then challenge, origin and crossOrigin.
    function _clientDataJSON(bytes32 challenge) internal pure returns (bytes memory) {
        return abi.encodePacked(
            '{"type":"webauthn.get",',
            _challengeField(challenge),
            ',"origin":"https://namera.test","crossOrigin":false}'
        );
    }

    function _authenticatorData(bytes1 flags) internal pure returns (bytes memory) {
        return abi.encodePacked(RP_ID_HASH, flags, uint32(1));
    }

    /// @dev An assertion of `challenge` with User Present and User Verified set.
    function _assert(TestPasskey memory passkey, bytes32 challenge)
        internal
        pure
        returns (Parts memory)
    {
        return _assertWith(
            passkey, _authenticatorData(FLAGS_UP_UV), _clientDataJSON(challenge), 23, 1
        );
    }

    function _assertWith(
        TestPasskey memory passkey,
        bytes memory authenticatorData,
        bytes memory clientDataJSON,
        uint16 challengeIndex,
        uint16 typeIndex
    ) internal pure returns (Parts memory parts) {
        parts.id = passkey.id;
        parts.authenticatorData = authenticatorData;
        parts.clientDataJSON = clientDataJSON;
        parts.challengeIndex = challengeIndex;
        parts.typeIndex = typeIndex;
        (parts.r, parts.s) = _signLowS(passkey.privateKey, authenticatorData, clientDataJSON);
    }

    function _signLowS(
        uint256 privateKey,
        bytes memory authenticatorData,
        bytes memory clientDataJSON
    ) internal pure returns (bytes32 r, bytes32 s) {
        bytes32 message = sha256(abi.encodePacked(authenticatorData, sha256(clientDataJSON)));
        (r, s) = vm.signP256(privateKey, message);
        if (uint256(s) > HALF_N) s = bytes32(P256.N - uint256(s));
    }

    function _encode(Parts memory parts) internal pure returns (bytes memory) {
        return abi.encodePacked(
            parts.id,
            parts.r,
            parts.s,
            parts.challengeIndex,
            parts.typeIndex,
            uint16(parts.authenticatorData.length),
            parts.authenticatorData,
            uint16(parts.clientDataJSON.length),
            parts.clientDataJSON
        );
    }

    /// @dev A direct-mode signature of the assertions, in the order given.
    function _signature(uint8 backend, Parts[] memory assertions)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(MODE_DIRECT, backend, _assertions(assertions));
    }

    function _signature(uint8 backend, Parts memory assertion)
        internal
        pure
        returns (bytes memory)
    {
        Parts[] memory assertions = new Parts[](1);
        assertions[0] = assertion;
        return _signature(backend, assertions);
    }

    function _multichainSignature(
        uint8 backend,
        bytes32 root,
        bytes32[] memory proof,
        Parts[] memory assertions
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            MODE_MULTICHAIN, backend, root, uint8(proof.length), proof, _assertions(assertions)
        );
    }

    function _assertions(Parts[] memory assertions) internal pure returns (bytes memory encoded) {
        encoded = abi.encodePacked(uint8(assertions.length));
        for (uint256 i; i < assertions.length; ++i) {
            encoded = abi.encodePacked(encoded, _encode(assertions[i]));
        }
    }

    /// @dev Assertions of `challenge` by each passkey, sorted by credential id as signatures require.
    function _assertAll(TestPasskey[] memory passkeys, bytes32 challenge)
        internal
        pure
        returns (Parts[] memory assertions)
    {
        assertions = new Parts[](passkeys.length);
        for (uint256 i; i < passkeys.length; ++i) {
            assertions[i] = _assert(passkeys[i], challenge);
        }
        for (uint256 i = 1; i < assertions.length; ++i) {
            for (
                uint256 j = i;
                j > 0 && uint256(assertions[j - 1].id) > uint256(assertions[j].id);
                --j
            ) {
                (assertions[j - 1], assertions[j]) = (assertions[j], assertions[j - 1]);
            }
        }
    }

    function _replaySafeHash(WebAuthnValidator validator, address account, bytes32 hash)
        internal
        view
        returns (bytes32)
    {
        return validator.replaySafeHash(account, hash);
    }
}
