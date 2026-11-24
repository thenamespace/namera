// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {PermissionId, Session} from "src/smart-sessions/DataTypes.sol";
import {ISmartSession} from "src/smart-sessions/ISmartSession.sol";

import {ERC7739Signer} from "../../utils/ERC7739Signer.sol";
import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";
import {
    MockAccount,
    MockDomainlessAccount,
    MockKernelAccount
} from "../../utils/mocks/MockAccount.sol";
import {MockPolicy, MockPolicyConfig} from "../../utils/mocks/MockPolicy.sol";
import {MockTypedDataPolicy} from "../../utils/mocks/MockTypedDataPolicy.sol";

/// @dev An account whose EIP-712 domain has a salt, to check the module binds every domain field.
contract MockSaltedAccount is MockAccount {
    constructor(address owner_) MockAccount(owner_) {}

    function eip712Domain()
        public
        view
        override
        returns (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        )
    {
        (fields, name, version, chainId, verifyingContract,, extensions) = super.eip712Domain();
        fields |= 0x10;
        salt = keccak256("account salt");
    }
}

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

        assertEq(result, bytes4(0x77390003));
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

    function test_contentsNameWithForbiddenCharacter_isRejected() public {
        string memory spaced = "Ma il(address to)";
        Session memory session = _signingSession().withERC7739Content(APP_DOMAIN, spaced);
        session.salt = keccak256("spaced");
        PermissionId spacedId = enableSession(session);
        ERC7739Signer.AppData memory app = mail;
        app.contentsType = spaced;
        app.contentsName = "Ma il";
        bytes memory signature = ERC7739Signer.sign(app, address(account), spacedId, sessionKey);

        assertEq(_isValidSignature(ERC7739Signer.appHash(app), signature), INVALID);
    }

    /// @dev Long types such as Permit2's must not overlap the account domain fields in memory.
    function test_longContentsType_isAccepted() public {
        string memory longType =
            "PermitBatchTransferFrom(TokenPermissions[] permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)";
        Session memory session = _signingSession().withERC7739Content(APP_DOMAIN, longType);
        session.salt = keccak256("long type");
        PermissionId longId = enableSession(session);
        ERC7739Signer.AppData memory app = ERC7739Signer.AppData({
            appDomainSeparator: APP_DOMAIN,
            contents: keccak256("permit struct hash"),
            contentsData: "",
            contentsType: longType,
            contentsName: "PermitBatchTransferFrom"
        });
        bytes memory signature = ERC7739Signer.sign(app, address(account), longId, sessionKey);

        assertEq(_isValidSignature(ERC7739Signer.appHash(app), signature), EIP1271_MAGIC);
    }

    function test_accountDomainSalt_isBound() public {
        MockSaltedAccount salted = new MockSaltedAccount(owner);
        installSmartSession(address(salted), "");
        PermissionId saltedId = enableSession(address(salted), _signingSession());
        bytes32 hash = ERC7739Signer.appHash(mail);
        bytes memory signature = ERC7739Signer.sign(mail, address(salted), saltedId, sessionKey);
        // Signed for the unsalted domain of an otherwise identical account.
        bytes memory unsalted = ERC7739Signer.sign(mail, address(account), saltedId, sessionKey);

        assertEq(
            salted.isValidSignature(hash, abi.encodePacked(address(smartSession), signature)),
            EIP1271_MAGIC
        );
        assertEq(
            salted.isValidSignature(hash, abi.encodePacked(address(smartSession), unsalted)),
            INVALID
        );
    }

    function test_kernelWrappedHash_isAccepted() public {
        MockKernelAccount kernel = new MockKernelAccount(owner);
        installSmartSession(address(kernel), "");
        PermissionId kernelId = enableSession(address(kernel), _signingSession());
        bytes memory signature = abi.encodePacked(
            address(smartSession), ERC7739Signer.sign(mail, address(kernel), kernelId, sessionKey)
        );
        ERC7739Signer.AppData memory otherMail = ERC7739Signer.mail(APP_DOMAIN, address(1));

        assertEq(kernel.isValidSignature(ERC7739Signer.appHash(mail), signature), EIP1271_MAGIC);
        assertEq(kernel.isValidSignature(ERC7739Signer.appHash(otherMail), signature), INVALID);
    }

    function testFuzz_kernelWrappedHash_isAcceptedForAnyMail(address to) public {
        MockKernelAccount kernel = new MockKernelAccount(owner);
        installSmartSession(address(kernel), "");
        PermissionId kernelId = enableSession(address(kernel), _signingSession());
        ERC7739Signer.AppData memory anyMail = ERC7739Signer.mail(APP_DOMAIN, to);
        bytes memory signature = abi.encodePacked(
            address(smartSession),
            ERC7739Signer.sign(anyMail, address(kernel), kernelId, sessionKey)
        );

        assertEq(kernel.isValidSignature(ERC7739Signer.appHash(anyMail), signature), EIP1271_MAGIC);
    }

    /// @dev Only an account named "Kernel" may ask about the Kernel wrapping of the app's hash.
    function test_kernelWrapping_isRefusedForOtherAccounts() public {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256("MockAccount"),
                keccak256("1"),
                block.chainid,
                address(account)
            )
        );
        bytes32 wrapped = keccak256(
            abi.encodePacked(
                hex"1901",
                domainSeparator,
                keccak256(
                    abi.encode(keccak256("Kernel(bytes32 hash)"), ERC7739Signer.appHash(mail))
                )
            )
        );

        vm.prank(address(account));
        assertEq(
            smartSession.isValidSignatureWithSender(
                address(this), wrapped, _sign(mail, sessionKey)
            ),
            INVALID
        );
    }

    function test_accountWithoutDomain_isBoundToItsChainAndAddress() public {
        MockDomainlessAccount domainless = new MockDomainlessAccount(owner);
        installSmartSession(address(domainless), "");
        PermissionId domainlessId = enableSession(address(domainless), _signingSession());
        bytes32 hash = ERC7739Signer.appHash(mail);
        bytes memory signature =
            ERC7739Signer.sign(mail, address(domainless), domainlessId, sessionKey);
        uint256 chainId = block.chainid;
        vm.chainId(chainId + 1);
        bytes memory otherChain =
            ERC7739Signer.sign(mail, address(domainless), domainlessId, sessionKey);
        vm.chainId(chainId);

        assertEq(
            domainless.isValidSignature(hash, abi.encodePacked(address(smartSession), signature)),
            EIP1271_MAGIC
        );
        assertEq(
            domainless.isValidSignature(hash, abi.encodePacked(address(smartSession), otherChain)),
            INVALID
        );
    }

    function test_appendixLongerThanSignature_isRejected() public view {
        bytes memory signature = _sign(mail, sessionKey);
        // Claim a contents description longer than the whole signature.
        signature[signature.length - 2] = 0xff;
        signature[signature.length - 1] = 0xff;

        assertEq(_isValidSignature(ERC7739Signer.appHash(mail), signature), INVALID);
    }

    /// @dev The typed data in the signature must be the signed struct's preimage, so policies can trust it.
    function test_typedDataThatIsNotTheStructsPreimage_isRejected() public {
        bytes memory forged = abi.encode(keccak256(bytes(MAIL)), makeAddr("someone else"));
        bytes memory signature =
            ERC7739Signer.sign(mail, address(account), permissionId, sessionKey, forged, "");

        assertEq(_isValidSignature(ERC7739Signer.appHash(mail), signature), INVALID);
    }

    /// @dev Forged typed data is refused whether its hash sorts below or above the signed struct's hash.
    function test_forgedTypedData_isRejectedWhicheverWayItsHashCompares() public view {
        bytes32 hash = ERC7739Signer.appHash(mail);
        bool below;
        bool above;
        for (uint256 i; !(below && above); ++i) {
            bytes memory forged = abi.encode(keccak256(bytes(MAIL)), address(uint160(i + 1)));
            if (keccak256(forged) < mail.contents) {
                if (below) continue;
                below = true;
            } else {
                if (above) continue;
                above = true;
            }
            bytes memory signature =
                ERC7739Signer.sign(mail, address(account), permissionId, sessionKey, forged, "");
            assertEq(_isValidSignature(hash, signature), INVALID);
        }
    }

    /// @dev Typed data is optional: a policy that doesn't read it still sees the session key's signature.
    function test_withoutTypedData_hashPoliciesStillPass() public view {
        bytes memory signature =
            ERC7739Signer.sign(mail, address(account), permissionId, sessionKey, "", "extra");

        assertEq(_isValidSignature(ERC7739Signer.appHash(mail), signature), EIP1271_MAGIC);
    }

    function test_typedDataLengthsPastTheSignature_areRejectedWithoutReverting() public view {
        bytes memory sessionKeySignature =
            ERC7739Signer.sessionKeySignature(mail, address(account), sessionKey);
        bytes32 hash = ERC7739Signer.appHash(mail);

        bytes memory overrun = abi.encodePacked(
            permissionId, sessionKeySignature, uint16(66), uint16(0), ERC7739Signer.appendix(mail)
        );
        assertEq(_isValidSignature(hash, overrun), INVALID);
        bytes memory tooShort =
            abi.encodePacked(permissionId, uint16(0), ERC7739Signer.appendix(mail));
        assertEq(_isValidSignature(hash, tooShort), INVALID);
        // Policy data longer than what precedes the lengths, with no typed data.
        bytes memory policyDataOverrun =
            abi.encodePacked(permissionId, uint16(0), uint16(4), ERC7739Signer.appendix(mail));
        assertEq(_isValidSignature(hash, policyDataOverrun), INVALID);
        bytes memory noRoomForTheLengths = abi.encodePacked(bytes3(0), ERC7739Signer.appendix(mail));
        assertEq(_isValidSignature(hash, noRoomForTheLengths), INVALID);
    }

    /// @dev Other lengths never validate and never revert. The one exception reads the same bytes as policy
    /// data with no typed data, which Smart Sessions does not check (the policy would).
    function testFuzz_wrongTypedDataLengthsNeverValidate(uint16 contentsLength, uint16 policyLength)
        public
        view
    {
        uint256 length = mail.contentsData.length;
        vm.assume(contentsLength != length || policyLength != 0);
        vm.assume(contentsLength != 0 || policyLength != length);
        bytes memory signature = abi.encodePacked(
            permissionId,
            ERC7739Signer.sessionKeySignature(mail, address(account), sessionKey),
            mail.contentsData,
            contentsLength,
            policyLength,
            ERC7739Signer.appendix(mail)
        );

        assertEq(_isValidSignature(ERC7739Signer.appHash(mail), signature), INVALID);
    }

    function test_typedDataPolicy_receivesTheVerifiedTypedDataAndItsPolicyData() public {
        MockTypedDataPolicy typedPolicy = new MockTypedDataPolicy();
        bytes memory policyData = "nested preimages";
        Session memory session = defaultSession()
            .withERC7739Content(APP_DOMAIN, MAIL)
            .withERC1271Policy(
                address(typedPolicy), abi.encode(APP_DOMAIN, mail.contentsData, policyData)
            );
        session.salt = keccak256("typed data");
        PermissionId typedId = enableSession(session);
        bytes32 hash = ERC7739Signer.appHash(mail);

        bytes memory signature = ERC7739Signer.sign(
            mail, address(account), typedId, sessionKey, mail.contentsData, policyData
        );
        assertEq(_isValidSignature(hash, signature), EIP1271_MAGIC);
        bytes memory otherPolicyData = ERC7739Signer.sign(
            mail, address(account), typedId, sessionKey, mail.contentsData, "other"
        );
        assertEq(_isValidSignature(hash, otherPolicyData), INVALID);
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
