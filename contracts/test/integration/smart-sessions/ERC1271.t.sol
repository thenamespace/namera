// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {PermissionId, Session} from "src/smart-sessions/DataTypes.sol";
import {ISmartSession} from "src/smart-sessions/ISmartSession.sol";

import {ERC7739Signer} from "../../utils/ERC7739Signer.sol";
import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";
import {MockPolicy, MockPolicyConfig} from "../../utils/mocks/MockPolicy.sol";

/// @notice Session-key ERC-1271 signatures (ERC-7739), checked through the account like a dapp would.
contract ERC1271Test is SmartSessionTestBase {
    using SessionBuilder for Session;

    bytes4 internal constant INVALID = 0xffffffff;
    bytes32 internal constant APP_DOMAIN = keccak256("app domain separator");
    string internal constant MAIL = "Mail(address to)";

    ERC7739Signer.AppData internal mail;
    PermissionId internal permissionId;

    function setUp() public override {
        super.setUp();
        mail = ERC7739Signer.mail(APP_DOMAIN, makeAddr("recipient"));
        permissionId =
            enableSession(_signingSession().withValidity(0, uint48(block.timestamp + 1 days)));
    }

    function test_supportProbe_reportsFixedVersion() public view {
        bytes4 result = smartSession.isValidSignatureWithSender(
            address(this), 0x7739773977397739773977397739773977397739773977397739773977397739, ""
        );

        assertEq(result, bytes4(0x77390002));
    }

    function test_validSessionSignature_isAccepted() public view {
        bytes memory signature = _sign(mail, sessionKey);

        assertEq(_isValidSignature(ERC7739Signer.appHash(mail), signature), EIP1271_MAGIC);
    }

    /// @dev Regression for the upstream bug: the signature must not validate for any other hash.
    function test_signatureForOneHash_isRejectedForAnotherHash() public view {
        bytes memory signature = _sign(mail, sessionKey);

        assertEq(_isValidSignature(keccak256("unrelated hash"), signature), INVALID);
    }

    /// @dev Regression for the upstream bug: a signed mail cannot authorize a different mail.
    function test_signatureForOneMessage_isRejectedForAnotherMessage() public {
        bytes memory signature = _sign(mail, sessionKey);
        ERC7739Signer.AppData memory attackerMail =
            ERC7739Signer.mail(APP_DOMAIN, makeAddr("attacker"));

        assertEq(_isValidSignature(ERC7739Signer.appHash(attackerMail), signature), INVALID);
    }

    function testFuzz_signatureNeverValidatesOtherHashes(bytes32 otherHash) public view {
        vm.assume(otherHash != ERC7739Signer.appHash(mail));
        bytes memory signature = _sign(mail, sessionKey);

        // The ERC-7739 support probe hash returns a marker, never the ERC-1271 magic value.
        assertNotEq(_isValidSignature(otherHash, signature), EIP1271_MAGIC);
    }

    function test_wrongSessionKey_isRejected() public {
        (, uint256 otherKey) = makeAddrAndKey("other");

        assertEq(_isValidSignature(ERC7739Signer.appHash(mail), _sign(mail, otherKey)), INVALID);
    }

    function test_contentNotEnabled_isRejected() public view {
        ERC7739Signer.AppData memory other = mail;
        other.contentsType = "Note(address to)";
        other.contentsName = "Note";
        other.contents = keccak256(abi.encode(keccak256("Note(address to)"), address(1)));

        assertEq(_isValidSignature(ERC7739Signer.appHash(other), _sign(other, sessionKey)), INVALID);
    }

    function test_otherAppDomain_isRejected() public view {
        ERC7739Signer.AppData memory otherApp =
            ERC7739Signer.mail(keccak256("other app"), address(1));

        assertEq(
            _isValidSignature(ERC7739Signer.appHash(otherApp), _sign(otherApp, sessionKey)), INVALID
        );
    }

    function test_expiredSession_isRejected() public {
        bytes memory signature = _sign(mail, sessionKey);
        vm.warp(block.timestamp + 1 days + 1);

        assertEq(_isValidSignature(ERC7739Signer.appHash(mail), signature), INVALID);
    }

    function test_sessionBeforeStart_isRejected() public {
        Session memory later = _signingSession().withValidity(uint48(block.timestamp + 1 hours), 0);
        later.salt = keccak256("later");
        PermissionId laterId = enableSession(later);
        bytes memory signature = ERC7739Signer.sign(mail, address(account), laterId, sessionKey);

        assertEq(_isValidSignature(ERC7739Signer.appHash(mail), signature), INVALID);
    }

    /// @dev Same bounds as the EntryPoint: valid from `validAfter` through `validUntil`, both inclusive.
    function test_windowBounds_matchTheEntryPoint() public {
        uint48 start = uint48(block.timestamp + 1 hours);
        uint48 end = start + 1 hours;
        Session memory session = _signingSession().withValidity(start, end);
        session.salt = keccak256("bounded");
        PermissionId boundedId = enableSession(session);
        bytes memory signature = ERC7739Signer.sign(mail, address(account), boundedId, sessionKey);
        bytes32 hash = ERC7739Signer.appHash(mail);

        vm.warp(start - 1);
        assertEq(_isValidSignature(hash, signature), INVALID);
        vm.warp(start);
        assertEq(_isValidSignature(hash, signature), EIP1271_MAGIC);
        vm.warp(end);
        assertEq(_isValidSignature(hash, signature), EIP1271_MAGIC);
        vm.warp(end + 1);
        assertEq(_isValidSignature(hash, signature), INVALID);
    }

    function test_unknownPermission_isRejected() public view {
        bytes memory signature = ERC7739Signer.sign(
            mail, address(account), PermissionId.wrap(keccak256("unknown")), sessionKey
        );

        assertEq(_isValidSignature(ERC7739Signer.appHash(mail), signature), INVALID);
    }

    function test_policyRejection_isRejected() public {
        Session memory session = _signingSession();
        session.erc7739Policies.erc1271Policies[0].initData = MockPolicyConfig.deny();
        session.salt = keccak256("denied");
        PermissionId deniedId = enableSession(session);
        bytes memory signature = ERC7739Signer.sign(mail, address(account), deniedId, sessionKey);

        assertEq(_isValidSignature(ERC7739Signer.appHash(mail), signature), INVALID);
    }

    function test_RevertWhen_sessionHasNoERC1271Policy() public {
        Session memory session = defaultSession().withERC7739Content(APP_DOMAIN, MAIL);
        session.salt = keccak256("no 1271 policy");
        PermissionId noPolicyId = enableSession(session);
        bytes memory signature = ERC7739Signer.sign(mail, address(account), noPolicyId, sessionKey);
        bytes32 hash = ERC7739Signer.appHash(mail);

        vm.expectRevert(abi.encodeWithSelector(ISmartSession.NoPoliciesSet.selector, noPolicyId));
        account.isValidSignature(hash, abi.encodePacked(address(smartSession), signature));
    }

    function test_moduleAsRequester_isRejected() public {
        bytes memory signature = _sign(mail, sessionKey);
        bytes32 hash = ERC7739Signer.appHash(mail);

        vm.prank(address(account));
        bytes4 result =
            smartSession.isValidSignatureWithSender(address(smartSession), hash, signature);

        assertEq(result, INVALID);
    }

    function testFuzz_anyOtherRequester_isAccepted(address requester) public {
        vm.assume(requester != address(smartSession));
        bytes memory signature = _sign(mail, sessionKey);
        bytes32 hash = ERC7739Signer.appHash(mail);

        vm.prank(requester);
        bytes4 result =
            account.isValidSignature(hash, abi.encodePacked(address(smartSession), signature));

        assertEq(result, EIP1271_MAGIC);
    }

    function test_everyERC1271PolicyIsChecked() public {
        MockPolicy secondPolicy = new MockPolicy(true);
        bytes32 hash = ERC7739Signer.appHash(mail);

        Session memory approved =
            _signingSession().withERC1271Policy(address(secondPolicy), MockPolicyConfig.allow());
        approved.salt = keccak256("both approve");
        PermissionId approvedId = enableSession(approved);
        assertEq(
            _isValidSignature(
                hash, ERC7739Signer.sign(mail, address(account), approvedId, sessionKey)
            ),
            EIP1271_MAGIC
        );

        Session memory rejected =
            _signingSession().withERC1271Policy(address(secondPolicy), MockPolicyConfig.deny());
        rejected.salt = keccak256("second rejects");
        PermissionId rejectedId = enableSession(rejected);
        assertEq(
            _isValidSignature(
                hash, ERC7739Signer.sign(mail, address(account), rejectedId, sessionKey)
            ),
            INVALID
        );
    }

    function test_removedSessionContent_isNotRestoredByReenabling() public {
        vm.prank(address(account));
        smartSession.removeSession(permissionId);
        Session memory withoutContent = defaultSession()
            .withERC7739Content(keccak256("other app"), MAIL)
            .withERC1271Policy(address(policy), MockPolicyConfig.allow());
        // Same validator, config and salt, so the same permission ID as the removed session.
        enableSession(withoutContent);

        assertEq(_isValidSignature(ERC7739Signer.appHash(mail), _sign(mail, sessionKey)), INVALID);
    }

    function test_erc6492WrappedSignature_isUnwrapped() public view {
        bytes memory signature = ERC7739Signer.wrap6492(_sign(mail, sessionKey));

        assertEq(_isValidSignature(ERC7739Signer.appHash(mail), signature), EIP1271_MAGIC);
    }

    function test_invalidContentsName_isRejected() public {
        string memory lowercase = "mail(address to)";
        Session memory session = _signingSession().withERC7739Content(APP_DOMAIN, lowercase);
        session.salt = keccak256("lowercase");
        PermissionId lowercaseId = enableSession(session);
        ERC7739Signer.AppData memory app = mail;
        app.contentsType = lowercase;
        app.contentsName = "mail";
        bytes memory signature = ERC7739Signer.sign(app, address(account), lowercaseId, sessionKey);

        assertEq(_isValidSignature(ERC7739Signer.appHash(app), signature), INVALID);
    }

    /// @dev Explicit mode: the description is `contentsType ‖ contentsName` and does not end with ')'.
    function test_explicitModeContentsDescription_isAccepted() public {
        string memory description = "Mail(address to)Mail";
        Session memory session = _signingSession().withERC7739Content(APP_DOMAIN, description);
        session.salt = keccak256("explicit");
        PermissionId explicitId = enableSession(session);
        ERC7739Signer.AppData memory app = mail;
        bytes memory signature = ERC7739Signer.sign(app, address(account), explicitId, sessionKey);
        // Replace the implicit-mode description with the explicit one in the signature appendix.
        bytes memory explicitSignature = abi.encodePacked(
            _withoutDescription(signature, bytes(app.contentsType).length),
            description,
            uint16(bytes(description).length)
        );

        assertEq(_isValidSignature(ERC7739Signer.appHash(app), explicitSignature), EIP1271_MAGIC);
    }

    function test_appendixLongerThanSignature_isRejected() public view {
        bytes memory signature = _sign(mail, sessionKey);
        // Claim a contents description longer than the whole signature.
        signature[signature.length - 2] = 0xff;
        signature[signature.length - 1] = 0xff;

        assertEq(_isValidSignature(ERC7739Signer.appHash(mail), signature), INVALID);
    }

    function _withoutDescription(bytes memory signature, uint256 descriptionLength)
        internal
        pure
        returns (bytes memory trimmed)
    {
        trimmed = new bytes(signature.length - descriptionLength - 2);
        for (uint256 i; i < trimmed.length; ++i) {
            trimmed[i] = signature[i];
        }
    }

    function _signingSession() internal view returns (Session memory) {
        return defaultSession()
            .withERC7739Content(APP_DOMAIN, MAIL)
            .withERC1271Policy(address(policy), MockPolicyConfig.allow());
    }

    function _sign(ERC7739Signer.AppData memory app, uint256 key)
        internal
        view
        returns (bytes memory)
    {
        return ERC7739Signer.sign(app, address(account), permissionId, key);
    }

    /// @dev ERC-1271 check through the account, which forwards `smartSession ‖ signature` to the module.
    function _isValidSignature(bytes32 hash, bytes memory signature)
        internal
        view
        returns (bytes4)
    {
        return account.isValidSignature(hash, abi.encodePacked(address(smartSession), signature));
    }
}
