// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {P256} from "@openzeppelin/contracts/utils/cryptography/P256.sol";
import {ERC4337} from "solady/accounts/ERC4337.sol";

import {WebAuthnValidator} from "src/validators/WebAuthnValidator.sol";
import {WebAuthnAssertion} from "src/validators/lib/WebAuthnAssertion.sol";

import {P256Precompile, P256PrecompileAnsweringZero} from "test/utils/P256Precompile.sol";
import {WebAuthnTestBase} from "test/utils/WebAuthnTestBase.sol";

contract WebAuthnValidatorTest is WebAuthnTestBase {
    bytes32 internal constant USER_OP_HASH = keccak256("user operation hash");
    bytes4 internal constant ERC1271_VALID = 0x1626ba7e;
    bytes4 internal constant ERC1271_INVALID = 0xffffffff;

    WebAuthnValidator internal validator;
    address internal account = makeAddr("account");
    address internal other = makeAddr("other account");
    address internal app = makeAddr("app");

    TestPasskey internal alice;
    TestPasskey internal bob;
    TestPasskey internal carol;

    function setUp() public {
        validator = new WebAuthnValidator();
        alice = _passkey("alice");
        bob = _passkey("bob");
        carol = _passkey("carol");
    }

    // --------------------------------------------------------------------------------------------
    // Module
    // --------------------------------------------------------------------------------------------

    function test_moduleTypes_validatorAndStatelessValidatorOnly() public view {
        assertTrue(validator.isModuleType(1));
        assertTrue(validator.isModuleType(7));
        assertFalse(validator.isModuleType(0));
        assertFalse(validator.isModuleType(2));
        assertFalse(validator.isModuleType(4));
        assertFalse(validator.isModuleType(10));
    }

    function test_install_storesPasskeysAndThreshold() public {
        _install(account, 2, _list(alice, bob, carol));

        (uint256 threshold, bytes32[] memory ids, WebAuthnAssertion.Passkey[] memory passkeys) =
            validator.getPasskeys(account);
        assertEq(threshold, 2);
        assertEq(ids.length, 3);
        assertEq(ids[0], alice.id);
        assertEq(ids[2], carol.id);
        assertEq(passkeys[1].x, bob.x);
        assertEq(passkeys[1].y, bob.y);
        assertTrue(passkeys[1].requireUserVerification);
        assertTrue(validator.isInitialized(account));
        assertFalse(validator.isInitialized(other));
    }

    function test_install_overwritesLeftoverState() public {
        _install(account, 1, _list(alice, bob));
        _install(account, 1, _list(carol));

        (, bytes32[] memory ids,) = validator.getPasskeys(account);
        assertEq(ids.length, 1);
        assertEq(ids[0], carol.id);
        assertFalse(
            _userOpValid(account, _signature(BACKEND_SOLIDITY, _assert(alice, USER_OP_HASH)))
        );
    }

    function test_install_rejectsBadConfig() public {
        WebAuthnAssertion.Passkey[] memory passkeys = new WebAuthnAssertion.Passkey[](1);
        passkeys[0] = WebAuthnAssertion.Passkey(bytes32(0), bytes32(0), true, bytes32(0));
        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(WebAuthnValidator.InvalidPasskey.selector, 0, 0));
        validator.onInstall(abi.encode(1, passkeys));

        passkeys[0] = _config(alice);
        passkeys[0].y = bytes32(uint256(passkeys[0].y) ^ 1);
        vm.prank(account);
        vm.expectRevert(
            abi.encodeWithSelector(
                WebAuthnValidator.InvalidPasskey.selector, passkeys[0].x, passkeys[0].y
            )
        );
        validator.onInstall(abi.encode(1, passkeys));

        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(WebAuthnValidator.InvalidThreshold.selector, 0, 0));
        validator.onInstall(abi.encode(0, new WebAuthnAssertion.Passkey[](0)));

        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(WebAuthnValidator.InvalidThreshold.selector, 3, 2));
        validator.onInstall(_installData(3, _list(alice, bob)));

        vm.prank(account);
        vm.expectRevert(
            abi.encodeWithSelector(WebAuthnValidator.DuplicatePasskey.selector, alice.id)
        );
        validator.onInstall(_installData(1, _list(alice, alice)));
    }

    function test_install_capsPasskeysAtSixteen() public {
        TestPasskey[] memory passkeys = new TestPasskey[](17);
        for (uint256 i; i < 17; ++i) {
            passkeys[i] = _passkey(string.concat("passkey", vm.toString(i)));
        }
        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(WebAuthnValidator.TooManyPasskeys.selector, 16));
        validator.onInstall(_installData(1, passkeys));
    }

    function test_uninstall_clearsEverything() public {
        _install(account, 2, _list(alice, bob));
        vm.prank(account);
        validator.onUninstall("");

        (uint256 threshold, bytes32[] memory ids,) = validator.getPasskeys(account);
        assertEq(threshold, 0);
        assertEq(ids.length, 0);
        assertFalse(validator.isInitialized(account));
        assertFalse(
            _userOpValid(account, _signature(BACKEND_SOLIDITY, _assert(alice, USER_OP_HASH)))
        );
    }

    // --------------------------------------------------------------------------------------------
    // Management
    // --------------------------------------------------------------------------------------------

    function test_addPasskey_lets_theNewPasskeySign() public {
        _install(account, 1, _list(alice));
        vm.prank(account);
        validator.addPasskey(_config(bob));

        assertTrue(_userOpValid(account, _signature(BACKEND_SOLIDITY, _assert(bob, USER_OP_HASH))));
    }

    function test_removePasskey_movesTheLastIntoItsPlace() public {
        _install(account, 1, _list(alice, bob, carol));
        vm.prank(account);
        validator.removePasskey(alice.id);

        (, bytes32[] memory ids,) = validator.getPasskeys(account);
        assertEq(ids.length, 2);
        assertEq(ids[0], carol.id);
        assertEq(ids[1], bob.id);
        assertFalse(
            _userOpValid(account, _signature(BACKEND_SOLIDITY, _assert(alice, USER_OP_HASH)))
        );
        assertTrue(
            _userOpValid(account, _signature(BACKEND_SOLIDITY, _assert(carol, USER_OP_HASH)))
        );

        vm.prank(account);
        validator.removePasskey(bob.id);
        (, ids,) = validator.getPasskeys(account);
        assertEq(ids.length, 1);
        assertEq(ids[0], carol.id);
    }

    function test_management_refusesToBreakTheAccount() public {
        _install(account, 2, _list(alice, bob));

        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(WebAuthnValidator.InvalidThreshold.selector, 2, 1));
        validator.removePasskey(alice.id);

        vm.prank(account);
        validator.setThreshold(1);
        vm.prank(account);
        validator.removePasskey(alice.id);

        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(WebAuthnValidator.InvalidThreshold.selector, 1, 0));
        validator.removePasskey(bob.id);

        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(WebAuthnValidator.InvalidThreshold.selector, 2, 1));
        validator.setThreshold(2);

        vm.prank(account);
        vm.expectRevert(
            abi.encodeWithSelector(WebAuthnValidator.PasskeyNotFound.selector, carol.id)
        );
        validator.removePasskey(carol.id);

        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(WebAuthnValidator.DuplicatePasskey.selector, bob.id));
        validator.addPasskey(_config(bob));
    }

    function test_management_requiresAnInstalledAccount() public {
        vm.startPrank(other);
        vm.expectRevert(abi.encodeWithSelector(WebAuthnValidator.NotInitialized.selector, other));
        validator.addPasskey(_config(alice));
        vm.expectRevert(abi.encodeWithSelector(WebAuthnValidator.NotInitialized.selector, other));
        validator.removePasskey(alice.id);
        vm.expectRevert(abi.encodeWithSelector(WebAuthnValidator.NotInitialized.selector, other));
        validator.setThreshold(1);
        vm.stopPrank();
    }

    function test_addPasskey_capsAtSixteen() public {
        _install(account, 1, _list(alice));
        for (uint256 i; i < 15; ++i) {
            vm.prank(account);
            validator.addPasskey(_config(_passkey(string.concat("passkey", vm.toString(i)))));
        }
        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(WebAuthnValidator.TooManyPasskeys.selector, 16));
        validator.addPasskey(_config(bob));
    }

    // --------------------------------------------------------------------------------------------
    // User operations
    // --------------------------------------------------------------------------------------------

    function test_userOp_validWithEitherBackend() public {
        _install(account, 1, _list(alice));
        Parts memory assertion = _assert(alice, USER_OP_HASH);

        assertTrue(_userOpValid(account, _signature(BACKEND_SOLIDITY, assertion)));
        vm.etch(address(0x100), address(new P256Precompile()).code);
        assertTrue(_userOpValid(account, _signature(BACKEND_PRECOMPILE, assertion)));
    }

    function test_userOp_precompileBackendFailsWithoutThePrecompile() public {
        _install(account, 1, _list(alice));

        assertFalse(
            _userOpValid(account, _signature(BACKEND_PRECOMPILE, _assert(alice, USER_OP_HASH)))
        );
    }

    function test_userOp_rejectsAnotherHashOrPasskey() public {
        _install(account, 1, _list(alice));

        assertFalse(
            _userOpValid(account, _signature(BACKEND_SOLIDITY, _assert(alice, keccak256("other"))))
        );
        Parts memory forged = _assert(bob, USER_OP_HASH);
        forged.id = alice.id;
        assertFalse(_userOpValid(account, _signature(BACKEND_SOLIDITY, forged)));
        assertFalse(_userOpValid(account, _signature(BACKEND_SOLIDITY, _assert(bob, USER_OP_HASH))));
        assertFalse(_userOpValid(other, _signature(BACKEND_SOLIDITY, _assert(alice, USER_OP_HASH))));
    }

    function test_userOp_rejectsMalleableAndOutOfRangeSignatures() public {
        _install(account, 1, _list(alice));
        vm.etch(address(0x100), address(new P256Precompile()).code);
        Parts memory assertion = _assert(alice, USER_OP_HASH);

        Parts memory high = assertion;
        high.s = bytes32(P256.N - uint256(assertion.s));
        for (uint8 backend; backend < 2; ++backend) {
            assertFalse(_userOpValid(account, _signature(backend, high)));
        }

        Parts memory zeroR = _assert(alice, USER_OP_HASH);
        zeroR.r = bytes32(0);
        Parts memory bigR = _assert(alice, USER_OP_HASH);
        bigR.r = bytes32(P256.N);
        Parts memory zeroS = _assert(alice, USER_OP_HASH);
        zeroS.s = bytes32(0);
        for (uint8 backend; backend < 2; ++backend) {
            assertFalse(_userOpValid(account, _signature(backend, zeroR)));
            assertFalse(_userOpValid(account, _signature(backend, bigR)));
            assertFalse(_userOpValid(account, _signature(backend, zeroS)));
        }
    }

    function test_userOp_checksTheAuthenticatorFlags() public {
        _install(account, 1, _list(alice));
        bytes memory clientDataJSON = _clientDataJSON(USER_OP_HASH);

        // User Present missing.
        assertFalse(_userOpValid(account, _flagged(alice, 0x04, clientDataJSON)));
        // User Verified missing while required.
        assertFalse(_userOpValid(account, _flagged(alice, 0x01, clientDataJSON)));
        // Backup State without Backup Eligible.
        assertFalse(_userOpValid(account, _flagged(alice, 0x15, clientDataJSON)));
        // Backed up and eligible: synced passkeys are fine.
        assertTrue(_userOpValid(account, _flagged(alice, 0x1d, clientDataJSON)));
    }

    function test_userOp_userVerificationCanBeOptionalPerPasskey() public {
        WebAuthnAssertion.Passkey[] memory passkeys = new WebAuthnAssertion.Passkey[](1);
        passkeys[0] = _config(alice);
        passkeys[0].requireUserVerification = false;
        vm.prank(account);
        validator.onInstall(abi.encode(1, passkeys));

        assertTrue(_userOpValid(account, _flagged(alice, 0x01, _clientDataJSON(USER_OP_HASH))));
        assertFalse(_userOpValid(account, _flagged(alice, 0x04, _clientDataJSON(USER_OP_HASH))));
    }

    function test_userOp_rpIdPinIsEnforced() public {
        WebAuthnAssertion.Passkey[] memory passkeys = new WebAuthnAssertion.Passkey[](1);
        passkeys[0] = _config(alice);
        passkeys[0].rpIdHash = RP_ID_HASH;
        vm.prank(account);
        validator.onInstall(abi.encode(1, passkeys));

        assertTrue(
            _userOpValid(account, _signature(BACKEND_SOLIDITY, _assert(alice, USER_OP_HASH)))
        );
        bytes memory authenticatorData =
            abi.encodePacked(sha256("evil.test"), FLAGS_UP_UV, uint32(1));
        Parts memory elsewhere =
            _assertWith(alice, authenticatorData, _clientDataJSON(USER_OP_HASH), 23, 1);
        assertFalse(_userOpValid(account, _signature(BACKEND_SOLIDITY, elsewhere)));
    }

    function test_userOp_checksTypeAndChallengeFields() public {
        _install(account, 1, _list(alice));
        bytes memory authenticatorData = _authenticatorData(FLAGS_UP_UV);
        bytes memory challengeField = _challengeField(USER_OP_HASH);

        // A registration's type.
        bytes memory create = abi.encodePacked(
            '{"type":"webauthn.create",', challengeField, ',"origin":"https://namera.test"}'
        );
        assertFalse(_userOpValid(account, _sign(alice, authenticatorData, create, 26, 1)));

        // Wrong hints into a valid clientDataJSON.
        bytes memory clientDataJSON = _clientDataJSON(USER_OP_HASH);
        assertFalse(_userOpValid(account, _sign(alice, authenticatorData, clientDataJSON, 22, 1)));
        assertFalse(_userOpValid(account, _sign(alice, authenticatorData, clientDataJSON, 23, 0)));
        assertFalse(
            _userOpValid(account, _sign(alice, authenticatorData, clientDataJSON, 65_535, 1))
        );
        assertFalse(
            _userOpValid(account, _sign(alice, authenticatorData, clientDataJSON, 23, 65_535))
        );

        // The challenge continues past the hash: the closing quote is part of the match.
        bytes memory longer = abi.encodePacked(
            '{"type":"webauthn.get","challenge":"',
            _base64(USER_OP_HASH),
            'AAAA","origin":"https://namera.test"}'
        );
        assertFalse(_userOpValid(account, _sign(alice, authenticatorData, longer, 23, 1)));
    }

    function test_userOp_acceptsOtherClientDataLayouts() public {
        _install(account, 1, _list(alice));
        bytes memory authenticatorData = _authenticatorData(FLAGS_UP_UV);
        bytes memory challengeField = _challengeField(USER_OP_HASH);

        // Firefox before 129: challenge first, type last.
        bytes memory firefox = abi.encodePacked(
            "{", challengeField, ',"origin":"https://namera.test","type":"webauthn.get"}'
        );
        assertTrue(
            _userOpValid(
                account, _sign(alice, authenticatorData, firefox, 1, _indexOf(firefox, '"type"'))
            )
        );

        // Chrome's random extra key and a cross-origin iframe.
        bytes memory chrome = abi.encodePacked(
            '{"type":"webauthn.get",',
            challengeField,
            ',"origin":"https://namera.test","crossOrigin":true,"topOrigin":"https://app.test",',
            '"other_keys_can_be_added_here":"do not compare clientDataJSON against a template"}'
        );
        assertTrue(_userOpValid(account, _sign(alice, authenticatorData, chrome, 23, 1)));
    }

    function test_userOp_rejectsShortAuthenticatorData() public {
        _install(account, 1, _list(alice));
        bytes memory shortData = abi.encodePacked(RP_ID_HASH, FLAGS_UP_UV, uint24(1));

        assertFalse(
            _userOpValid(account, _sign(alice, shortData, _clientDataJSON(USER_OP_HASH), 23, 1))
        );
    }

    function test_userOp_rejectsMalformedEnvelopes() public {
        _install(account, 1, _list(alice));
        bytes memory valid = _signature(BACKEND_SOLIDITY, _assert(alice, USER_OP_HASH));
        assertTrue(_userOpValid(account, valid));

        bytes memory unknownMode = bytes.concat(valid);
        unknownMode[0] = 0x02;
        bytes memory unknownBackend = bytes.concat(valid);
        unknownBackend[1] = 0x02;
        bytes memory noAssertions = abi.encodePacked(MODE_DIRECT, BACKEND_SOLIDITY, uint8(0));

        assertFalse(_userOpValid(account, unknownMode));
        assertFalse(_userOpValid(account, unknownBackend));
        assertFalse(_userOpValid(account, noAssertions));
        assertFalse(_userOpValid(account, bytes.concat(valid, hex"00")));
        assertFalse(_userOpValid(account, ""));
    }

    /// @dev Every prefix of a valid signature fails without reverting.
    function test_userOp_everyTruncationFails() public {
        _install(account, 1, _list(alice));
        bytes memory valid = _signature(BACKEND_SOLIDITY, _assert(alice, USER_OP_HASH));

        for (uint256 length; length < valid.length; ++length) {
            bytes memory truncated = new bytes(length);
            for (uint256 i; i < length; ++i) {
                truncated[i] = valid[i];
            }
            assertFalse(_userOpValid(account, truncated));
        }
    }

    /// @dev Both backends accept every key and hash, and agree that a signature for another hash is invalid.
    function testFuzz_userOp_backendsAgree(uint256 seed, bytes32 hash, bytes32 otherHash) public {
        vm.assume(hash != otherHash);
        TestPasskey memory passkey = _passkey(vm.toString(seed));
        _install(account, 1, _list(passkey));
        vm.etch(address(0x100), address(new P256Precompile()).code);
        Parts memory assertion = _assert(passkey, hash);

        assertTrue(_userOpValidFor(account, hash, _signature(BACKEND_SOLIDITY, assertion)));
        assertTrue(_userOpValidFor(account, hash, _signature(BACKEND_PRECOMPILE, assertion)));
        assertFalse(_userOpValidFor(account, otherHash, _signature(BACKEND_SOLIDITY, assertion)));
        assertFalse(_userOpValidFor(account, otherHash, _signature(BACKEND_PRECOMPILE, assertion)));
    }

    function testFuzz_userOp_neverRevertsOnGarbage(bytes calldata signature) public {
        _install(account, 1, _list(alice));
        assertFalse(_userOpValid(account, signature));
    }

    function testFuzz_userOp_neverRevertsOnCorruptedAssertions(uint256 index, uint8 value) public {
        _install(account, 1, _list(alice));
        bytes memory signature = _signature(BACKEND_SOLIDITY, _assert(alice, USER_OP_HASH));
        index = bound(index, 0, signature.length - 1);
        vm.assume(uint8(signature[index]) != value);
        signature[index] = bytes1(value);

        // Some bytes do not change the outcome (the counter, origin); none may make it revert.
        _userOpValid(account, signature);
    }

    // --------------------------------------------------------------------------------------------
    // Thresholds
    // --------------------------------------------------------------------------------------------

    function test_threshold_needsEnoughDistinctPasskeys() public {
        _install(account, 2, _list(alice, bob, carol));
        Parts[] memory all = _assertAll(_list(alice, bob, carol), USER_OP_HASH);

        Parts[] memory two = new Parts[](2);
        (two[0], two[1]) = (all[0], all[2]);
        assertTrue(_userOpValid(account, _signature(BACKEND_SOLIDITY, two)));
        assertTrue(_userOpValid(account, _signature(BACKEND_SOLIDITY, all)));

        Parts[] memory one = new Parts[](1);
        one[0] = all[1];
        assertFalse(_userOpValid(account, _signature(BACKEND_SOLIDITY, one)));

        // The same passkey twice, or out of order.
        (two[0], two[1]) = (all[0], all[0]);
        assertFalse(_userOpValid(account, _signature(BACKEND_SOLIDITY, two)));
        (two[0], two[1]) = (all[2], all[0]);
        assertFalse(_userOpValid(account, _signature(BACKEND_SOLIDITY, two)));
    }

    function test_threshold_oneBadAssertionFailsTheSignature() public {
        _install(account, 2, _list(alice, bob));
        Parts[] memory both = _assertAll(_list(alice, bob), USER_OP_HASH);
        both[1].r = both[0].r;

        assertFalse(_userOpValid(account, _signature(BACKEND_SOLIDITY, both)));
    }

    // --------------------------------------------------------------------------------------------
    // Multichain
    // --------------------------------------------------------------------------------------------

    function test_multichain_oneAssertionApprovesEveryLeaf() public {
        _install(account, 1, _list(alice));
        bytes32 base = keccak256("base user operation hash");
        bytes32 arbitrum = keccak256("arbitrum user operation hash");
        (bytes32 root, bytes32 leafBase, bytes32 leafArbitrum) = _tree(base, arbitrum);
        Parts[] memory assertions = new Parts[](1);
        assertions[0] = _assert(alice, validator.multichainChallenge(root));

        bytes32[] memory proof = new bytes32[](1);
        proof[0] = leafArbitrum;
        assertTrue(
            _userOpValidFor(
                account, base, _multichainSignature(BACKEND_SOLIDITY, root, proof, assertions)
            )
        );
        proof[0] = leafBase;
        assertTrue(
            _userOpValidFor(
                account, arbitrum, _multichainSignature(BACKEND_SOLIDITY, root, proof, assertions)
            )
        );

        // A hash that is not a leaf.
        assertFalse(
            _userOpValidFor(
                account,
                USER_OP_HASH,
                _multichainSignature(BACKEND_SOLIDITY, root, proof, assertions)
            )
        );
        // The root itself, signed directly, is not a user operation hash.
        assertFalse(_userOpValidFor(account, base, _signature(BACKEND_SOLIDITY, assertions)));
    }

    /// @dev A stub whose proof fails still pays for its assertions, so estimates cover a real multichain signature.
    function test_gas_failingProofStillVerifiesTheAssertions() public {
        _install(account, 1, _list(alice));
        (bytes32 root,, bytes32 leafB) = _tree(USER_OP_HASH, keccak256("b"));
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = leafB;
        Parts[] memory assertions = new Parts[](1);
        assertions[0] = _assert(alice, validator.multichainChallenge(root));
        bytes memory real = _multichainSignature(BACKEND_SOLIDITY, root, proof, assertions);
        proof[0] = bytes32(type(uint256).max);
        bytes memory stub =
            _multichainSignature(BACKEND_SOLIDITY, bytes32(type(uint256).max), proof, assertions);

        uint256 before = gasleft();
        assertTrue(_userOpValid(account, real));
        uint256 realGas = before - gasleft();
        before = gasleft();
        assertFalse(_userOpValid(account, stub));
        uint256 stubGas = before - gasleft();

        assertApproxEqRel(stubGas, realGas, 0.05e18);
    }

    function test_multichain_isRefusedForERC1271AndSessions() public {
        _install(account, 1, _list(alice));
        (bytes32 root,, bytes32 leafB) = _tree(USER_OP_HASH, keccak256("b"));
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = leafB;
        Parts[] memory assertions = new Parts[](1);
        assertions[0] = _assert(alice, validator.multichainChallenge(root));
        bytes memory signature = _multichainSignature(BACKEND_SOLIDITY, root, proof, assertions);

        vm.prank(account);
        assertEq(
            validator.isValidSignatureWithSender(account, USER_OP_HASH, signature), ERC1271_INVALID
        );
        assertFalse(
            validator.validateSignatureWithData(
                USER_OP_HASH, signature, _installData(1, _list(alice))
            )
        );
    }

    // --------------------------------------------------------------------------------------------
    // ERC-1271
    // --------------------------------------------------------------------------------------------

    function test_erc1271_signaturesAreBoundToTheAccount() public {
        _install(account, 1, _list(alice));
        _install(other, 1, _list(alice));
        bytes32 hash = keccak256("permit");
        bytes memory signature =
            _signature(BACKEND_SOLIDITY, _assert(alice, validator.replaySafeHash(account, hash)));

        vm.prank(account);
        assertEq(validator.isValidSignatureWithSender(app, hash, signature), ERC1271_VALID);
        vm.prank(other);
        assertEq(validator.isValidSignatureWithSender(app, hash, signature), ERC1271_INVALID);

        // A signature over the raw hash is not accepted from an outside caller.
        bytes memory raw = _signature(BACKEND_SOLIDITY, _assert(alice, hash));
        vm.prank(account);
        assertEq(validator.isValidSignatureWithSender(app, hash, raw), ERC1271_INVALID);
    }

    function test_erc1271_signaturesAreBoundToTheChain() public {
        _install(account, 1, _list(alice));
        bytes32 hash = keccak256("permit");
        bytes memory signature =
            _signature(BACKEND_SOLIDITY, _assert(alice, validator.replaySafeHash(account, hash)));

        vm.prank(account);
        assertEq(validator.isValidSignatureWithSender(app, hash, signature), ERC1271_VALID);
        vm.chainId(block.chainid + 1);
        vm.prank(account);
        assertEq(validator.isValidSignatureWithSender(app, hash, signature), ERC1271_INVALID);
    }

    function test_erc1271_theAccountAsksWithTheBareDigest() public {
        _install(account, 1, _list(alice));
        bytes32 digest = keccak256("enable digest bound to the account");

        bytes memory signature = _signature(BACKEND_SOLIDITY, _assert(alice, digest));

        vm.prank(account);
        assertEq(validator.isValidSignatureWithSender(account, digest, signature), ERC1271_VALID);
    }

    function test_erc1271_emptySignatureIsInvalid() public {
        _install(account, 1, _list(alice));
        vm.prank(account);
        assertEq(
            validator.isValidSignatureWithSender(
                app, bytes32(0x7739773977397739773977397739773977397739773977397739773977397739), ""
            ),
            ERC1271_INVALID
        );
    }

    function test_replaySafeHash_isEIP712InTheValidatorsDomain() public view {
        bytes32 hash = keccak256("permit");
        bytes32 domain = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256("WebAuthnValidator"),
                keccak256("1"),
                block.chainid,
                address(validator)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(keccak256("ReplaySafeHash(address account,bytes32 hash)"), account, hash)
        );

        assertEq(
            validator.replaySafeHash(account, hash),
            keccak256(abi.encodePacked(hex"1901", domain, structHash))
        );
    }

    // --------------------------------------------------------------------------------------------
    // Stateless (Smart Sessions)
    // --------------------------------------------------------------------------------------------

    function test_stateless_checksAgainstTheGivenPasskeys() public view {
        bytes memory data = _installData(1, _list(alice, bob));

        assertTrue(
            validator.validateSignatureWithData(
                USER_OP_HASH, _signature(BACKEND_SOLIDITY, _assert(bob, USER_OP_HASH)), data
            )
        );
        assertFalse(
            validator.validateSignatureWithData(
                USER_OP_HASH, _signature(BACKEND_SOLIDITY, _assert(carol, USER_OP_HASH)), data
            )
        );
    }

    function test_stateless_threshold() public view {
        bytes memory data = _installData(2, _list(alice, bob, carol));
        Parts[] memory all = _assertAll(_list(alice, bob, carol), USER_OP_HASH);
        Parts[] memory one = new Parts[](1);
        one[0] = all[0];

        assertTrue(
            validator.validateSignatureWithData(
                USER_OP_HASH, _signature(BACKEND_SOLIDITY, all), data
            )
        );
        assertFalse(
            validator.validateSignatureWithData(
                USER_OP_HASH, _signature(BACKEND_SOLIDITY, one), data
            )
        );
    }

    /// @dev The config may list a passkey twice; a signature still counts it once.
    function test_stateless_duplicatePasskeyInConfigCountsOnce() public view {
        bytes memory data = _installData(2, _list(alice, alice));
        Parts[] memory twice = new Parts[](2);
        twice[0] = _assert(alice, USER_OP_HASH);
        twice[1] = twice[0];

        assertFalse(
            validator.validateSignatureWithData(
                USER_OP_HASH, _signature(BACKEND_SOLIDITY, twice), data
            )
        );
    }

    function test_stateless_rejectsBadConfig() public view {
        bytes memory signature = _signature(BACKEND_SOLIDITY, _assert(alice, USER_OP_HASH));
        WebAuthnAssertion.Passkey[] memory offCurve = new WebAuthnAssertion.Passkey[](1);
        offCurve[0] = _config(alice);
        offCurve[0].x = bytes32(uint256(offCurve[0].x) ^ 1);

        assertFalse(
            validator.validateSignatureWithData(
                USER_OP_HASH, signature, _installData(0, _list(alice))
            )
        );
        assertFalse(
            validator.validateSignatureWithData(
                USER_OP_HASH, signature, _installData(2, _list(alice))
            )
        );
        assertFalse(
            validator.validateSignatureWithData(USER_OP_HASH, signature, abi.encode(1, offCurve))
        );
    }

    function testFuzz_stateless_neverRevertsOnGarbage(bytes calldata signature) public view {
        assertFalse(
            validator.validateSignatureWithData(
                USER_OP_HASH, signature, _installData(1, _list(alice))
            )
        );
    }

    // --------------------------------------------------------------------------------------------
    // Gas estimation
    // --------------------------------------------------------------------------------------------

    /// @dev A stub that fails the field checks still pays for P-256, so estimates cover the real signature.
    function test_gas_failingFieldsStillVerifyTheSignature() public {
        _install(account, 1, _list(alice));
        bytes memory real = _signature(BACKEND_SOLIDITY, _assert(alice, USER_OP_HASH));
        bytes memory stub = _signature(BACKEND_SOLIDITY, _assert(alice, keccak256("stub")));

        uint256 before = gasleft();
        _userOpValid(account, real);
        uint256 realGas = before - gasleft();
        before = gasleft();
        _userOpValid(account, stub);
        uint256 stubGas = before - gasleft();

        // Solidity P-256 cost varies a little with the scalars; the SDK adds its own margin on top.
        assertApproxEqRel(stubGas, realGas, 0.05e18);
    }

    // --------------------------------------------------------------------------------------------
    // Edges
    // --------------------------------------------------------------------------------------------

    function test_removePasskey_keepsTheThresholdReachable() public {
        _install(account, 2, _list(alice, bob, carol));
        vm.prank(account);
        validator.removePasskey(bob.id);

        (uint256 threshold, bytes32[] memory ids,) = validator.getPasskeys(account);
        assertEq(threshold, 2);
        assertEq(ids.length, 2);
        assertEq(ids[0], alice.id);
        assertEq(ids[1], carol.id);
    }

    /// @dev Removal leaves no stale index behind: `_credentialIds` (slot 1) is empty past the count.
    function test_removeAndUninstall_clearTheIndex() public {
        _install(account, 1, _list(alice, bob, carol));
        vm.prank(account);
        validator.removePasskey(alice.id);
        assertEq(vm.load(address(validator), _indexSlot(2, account)), bytes32(0));

        vm.prank(account);
        validator.onUninstall("");
        for (uint256 i; i < 3; ++i) {
            assertEq(vm.load(address(validator), _indexSlot(i, account)), bytes32(0));
        }
    }

    function test_erc1271_onlyTheAccountItselfGetsTheBareDigest() public {
        _install(account, 1, _list(alice));
        bytes32 digest = keccak256("bare digest");
        bytes memory signature = _signature(BACKEND_SOLIDITY, _assert(alice, digest));

        for (uint160 sender = 1; sender < 4; ++sender) {
            vm.prank(account);
            assertEq(
                validator.isValidSignatureWithSender(address(sender), digest, signature),
                ERC1271_INVALID
            );
        }
        vm.prank(account);
        assertEq(
            validator.isValidSignatureWithSender(address(type(uint160).max), digest, signature),
            ERC1271_INVALID
        );
    }

    function test_unknownModeIsInvalidEvenWithAMultichainBody() public {
        _install(account, 1, _list(alice));
        (bytes32 root,, bytes32 leafB) = _tree(USER_OP_HASH, keccak256("b"));
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = leafB;
        Parts[] memory assertions = new Parts[](1);
        assertions[0] = _assert(alice, validator.multichainChallenge(root));
        bytes memory signature = _multichainSignature(BACKEND_SOLIDITY, root, proof, assertions);
        assertTrue(_userOpValid(account, signature));

        signature[0] = 0x02;
        assertFalse(_userOpValid(account, signature));
        vm.prank(account);
        assertEq(
            validator.isValidSignatureWithSender(app, USER_OP_HASH, signature), ERC1271_INVALID
        );
    }

    function test_multichain_deeperTrees() public {
        _install(account, 1, _list(alice));
        bytes32[3] memory hashes = [keccak256("a"), keccak256("b"), keccak256("c")];
        bytes32[3] memory leaves = [
            keccak256(abi.encode(hashes[0])),
            keccak256(abi.encode(hashes[1])),
            keccak256(abi.encode(hashes[2]))
        ];
        bytes32 ab = _parent(leaves[0], leaves[1]);
        bytes32 root = _parent(ab, leaves[2]);
        Parts[] memory assertions = new Parts[](1);
        assertions[0] = _assert(alice, validator.multichainChallenge(root));

        bytes32[] memory proof = new bytes32[](2);
        (proof[0], proof[1]) = (leaves[1], leaves[2]);
        assertTrue(
            _userOpValidFor(
                account, hashes[0], _multichainSignature(BACKEND_SOLIDITY, root, proof, assertions)
            )
        );
        (proof[0], proof[1]) = (leaves[0], leaves[2]);
        assertTrue(
            _userOpValidFor(
                account, hashes[1], _multichainSignature(BACKEND_SOLIDITY, root, proof, assertions)
            )
        );
        bytes32[] memory short = new bytes32[](1);
        short[0] = ab;
        assertTrue(
            _userOpValidFor(
                account, hashes[2], _multichainSignature(BACKEND_SOLIDITY, root, short, assertions)
            )
        );

        // A proof for another leaf.
        assertFalse(
            _userOpValidFor(
                account, hashes[2], _multichainSignature(BACKEND_SOLIDITY, root, proof, assertions)
            )
        );
    }

    function test_multichain_everyTruncationFails() public {
        _install(account, 1, _list(alice));
        bytes32[3] memory leaves = [
            keccak256(abi.encode(USER_OP_HASH)),
            keccak256(abi.encode(keccak256("b"))),
            keccak256(abi.encode(keccak256("c")))
        ];
        bytes32 root = _parent(_parent(leaves[0], leaves[1]), leaves[2]);
        bytes32[] memory proof = new bytes32[](2);
        (proof[0], proof[1]) = (leaves[1], leaves[2]);
        Parts[] memory assertions = new Parts[](1);
        assertions[0] = _assert(alice, validator.multichainChallenge(root));
        bytes memory valid = _multichainSignature(BACKEND_SOLIDITY, root, proof, assertions);
        assertTrue(_userOpValid(account, valid));

        for (uint256 length; length < valid.length; ++length) {
            bytes memory truncated = new bytes(length);
            for (uint256 i; i < length; ++i) {
                truncated[i] = valid[i];
            }
            assertFalse(_userOpValid(account, truncated));
        }
    }

    function test_userOp_acceptsAuthenticatorDataWithExtensions() public {
        _install(account, 1, _list(alice));
        bytes memory extended =
            abi.encodePacked(_authenticatorData(0x85), hex"a16b6372656450726f7465637402");

        assertTrue(
            _userOpValid(account, _sign(alice, extended, _clientDataJSON(USER_OP_HASH), 23, 1))
        );
    }

    function test_userOp_fieldsAtTheVeryEnd() public {
        _install(account, 1, _list(alice));
        bytes memory authenticatorData = _authenticatorData(FLAGS_UP_UV);
        bytes memory challengeField = _challengeField(USER_OP_HASH);

        // Both fields end the JSON; the checks reach its last byte, and one past it is out of range.
        bytes memory typeLast = abi.encodePacked("{", challengeField, ',"type":"webauthn.get"');
        uint16 typeIndex = uint16(typeLast.length - 21);
        assertTrue(_userOpValid(account, _sign(alice, authenticatorData, typeLast, 1, typeIndex)));
        assertFalse(
            _userOpValid(account, _sign(alice, authenticatorData, typeLast, 1, typeIndex + 1))
        );

        bytes memory challengeLast = abi.encodePacked('{"type":"webauthn.get",', challengeField);
        uint16 challengeIndex = uint16(challengeLast.length - 57);
        assertTrue(
            _userOpValid(account, _sign(alice, authenticatorData, challengeLast, challengeIndex, 1))
        );
        assertFalse(
            _userOpValid(
                account, _sign(alice, authenticatorData, challengeLast, challengeIndex + 1, 1)
            )
        );

        // Too short to hold either field.
        bytes memory tiny = bytes('"type":"webauthn.get"');
        assertFalse(_userOpValid(account, _sign(alice, authenticatorData, tiny, 0, 0)));
    }

    /// @dev Failures never cancel each other out.
    function test_userOp_twoFailuresStayAFailure() public {
        _install(account, 1, _list(alice));
        bytes memory authenticatorData = _authenticatorData(FLAGS_UP_UV);

        bytes memory create = abi.encodePacked(
            '{"type":"webauthn.create",', _challengeField(keccak256("other")), "}"
        );
        assertFalse(_userOpValid(account, _sign(alice, authenticatorData, create, 26, 1)));

        Parts memory badSignature = _assert(alice, keccak256("other"));
        badSignature.r = bytes32(uint256(badSignature.r) ^ 1);
        assertFalse(_userOpValid(account, _signature(BACKEND_SOLIDITY, badSignature)));

        WebAuthnAssertion.Passkey[] memory pinned = new WebAuthnAssertion.Passkey[](1);
        pinned[0] = _config(alice);
        pinned[0].rpIdHash = bytes32(type(uint256).max);
        vm.prank(other);
        validator.onInstall(abi.encode(1, pinned));
        // User Present missing and another relying party.
        assertFalse(_userOpValid(other, _flagged(alice, 0x04, _clientDataJSON(USER_OP_HASH))));
        // Another relying party whose hash sorts below the pinned one.
        assertFalse(_userOpValid(other, _signature(BACKEND_SOLIDITY, _assert(alice, USER_OP_HASH))));
    }

    function test_threshold_twoBadAssertionsStayInvalid() public {
        _install(account, 2, _list(alice, bob));
        Parts[] memory both = _assertAll(_list(alice, bob), keccak256("other"));

        assertFalse(_userOpValid(account, _signature(BACKEND_SOLIDITY, both)));
    }

    function test_threshold_allSixteenPasskeys() public {
        TestPasskey[] memory passkeys = new TestPasskey[](16);
        for (uint256 i; i < 16; ++i) {
            passkeys[i] = _passkey(string.concat("passkey", vm.toString(i)));
        }
        _install(account, 16, passkeys);
        vm.etch(address(0x100), address(new P256Precompile()).code);

        assertTrue(
            _userOpValid(
                account, _signature(BACKEND_PRECOMPILE, _assertAll(passkeys, USER_OP_HASH))
            )
        );
    }

    function test_precompile_answeringZeroIsInvalid() public {
        _install(account, 1, _list(alice));
        vm.etch(address(0x100), address(new P256PrecompileAnsweringZero()).code);

        assertTrue(
            _userOpValid(account, _signature(BACKEND_PRECOMPILE, _assert(alice, USER_OP_HASH)))
        );
        assertFalse(
            _userOpValid(
                account, _signature(BACKEND_PRECOMPILE, _assert(alice, keccak256("other")))
            )
        );
    }

    /// @dev The stateless lookup matches the exact credential id, not the first passkey that sorts after it.
    function test_stateless_findsTheExactPasskey() public view {
        (TestPasskey memory low, TestPasskey memory high) =
            uint256(alice.id) < uint256(bob.id) ? (alice, bob) : (bob, alice);
        bytes memory data = _installData(1, _list(high, low));

        assertTrue(
            validator.validateSignatureWithData(
                USER_OP_HASH, _signature(BACKEND_SOLIDITY, _assert(low, USER_OP_HASH)), data
            )
        );
    }

    // --------------------------------------------------------------------------------------------
    // Helpers
    // --------------------------------------------------------------------------------------------

    function _install(address who, uint256 threshold, TestPasskey[] memory passkeys) internal {
        vm.prank(who);
        validator.onInstall(_installData(threshold, passkeys));
    }

    function _userOpValid(address who, bytes memory signature) internal returns (bool) {
        return _userOpValidFor(who, USER_OP_HASH, signature);
    }

    function _userOpValidFor(address who, bytes32 hash, bytes memory signature)
        internal
        returns (bool)
    {
        ERC4337.PackedUserOperation memory userOp;
        userOp.sender = who;
        userOp.signature = signature;
        vm.prank(who);
        return validator.validateUserOp(userOp, hash) == 0;
    }

    function _flagged(TestPasskey memory passkey, bytes1 flags, bytes memory clientDataJSON)
        internal
        pure
        returns (bytes memory)
    {
        return _signature(
            BACKEND_SOLIDITY, _assertWith(passkey, _authenticatorData(flags), clientDataJSON, 23, 1)
        );
    }

    function _sign(
        TestPasskey memory passkey,
        bytes memory authenticatorData,
        bytes memory clientDataJSON,
        uint16 challengeIndex,
        uint16 typeIndex
    ) internal pure returns (bytes memory) {
        return _signature(
            BACKEND_SOLIDITY,
            _assertWith(passkey, authenticatorData, clientDataJSON, challengeIndex, typeIndex)
        );
    }

    function _parent(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return uint256(a) < uint256(b)
            ? keccak256(abi.encodePacked(a, b))
            : keccak256(abi.encodePacked(b, a));
    }

    /// @dev The storage slot of `_credentialIds[index][account]`: the mapping is the validator's slot 1.
    function _indexSlot(uint256 index, address who) internal pure returns (bytes32) {
        return keccak256(abi.encode(who, keccak256(abi.encode(index, uint256(1)))));
    }

    function _indexOf(bytes memory haystack, bytes memory needle) internal pure returns (uint16) {
        for (uint256 i; i + needle.length <= haystack.length; ++i) {
            bool found = true;
            for (uint256 j; j < needle.length && found; ++j) {
                found = haystack[i + j] == needle[j];
            }
            if (found) return uint16(i);
        }
        revert("not found");
    }

    function _base64(bytes32 value) internal pure returns (bytes memory) {
        bytes memory field = _challengeField(value);
        bytes memory encoded = new bytes(43);
        for (uint256 i; i < 43; ++i) {
            encoded[i] = field[13 + i];
        }
        return encoded;
    }

    /// @dev A two-leaf tree over user operation hashes, with leaves `keccak256(abi.encode(hash))` and sorted pairs.
    function _tree(bytes32 a, bytes32 b)
        internal
        pure
        returns (bytes32 root, bytes32 leafA, bytes32 leafB)
    {
        leafA = keccak256(abi.encode(a));
        leafB = keccak256(abi.encode(b));
        root = uint256(leafA) < uint256(leafB)
            ? keccak256(abi.encodePacked(leafA, leafB))
            : keccak256(abi.encodePacked(leafB, leafA));
    }
}
