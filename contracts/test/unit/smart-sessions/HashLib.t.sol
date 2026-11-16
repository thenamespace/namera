// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {
    ActionData,
    ChainDigest,
    ERC7739Data,
    PermissionId,
    PolicyData,
    Session,
    SmartSessionMode
} from "src/smart-sessions/DataTypes.sol";
import {
    ACTION_DATA_TYPEHASH,
    CHAIN_SESSION_TYPEHASH,
    ERC7739_CONTEXT_TYPEHASH,
    ERC7739_DATA_TYPEHASH,
    HashLib,
    MULTICHAIN_SESSION_TYPEHASH,
    POLICY_DATA_TYPEHASH,
    SESSION_TYPEHASH,
    SIGNED_PERMISSIONS_TYPEHASH
} from "src/smart-sessions/lib/HashLib.sol";

import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {SessionTypes} from "../../utils/SessionTypes.sol";
import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";
import {MockPolicyConfig} from "../../utils/mocks/MockPolicy.sol";

/// @dev EIP-712 structures as the owner's wallet signs them (field order matches the type strings).
struct SignedPermissions {
    bool permitGenericPolicy;
    bool permitAdminAccess;
    bool ignoreSecurityAttestations;
    bool permitERC4337Paymaster;
    PolicyData[] userOpPolicies;
    ERC7739Data erc7739Policies;
    ActionData[] actions;
}

struct SignedSession {
    address account;
    SignedPermissions permissions;
    address sessionValidator;
    bytes sessionValidatorInitData;
    bytes32 salt;
    uint48 validAfter;
    uint48 validUntil;
    address smartSession;
    uint256 nonce;
}

contract HashLibTest is SmartSessionTestBase {
    using SessionBuilder for Session;

    function test_typehashesMatchTypeDefinitions() public pure {
        assertEq(POLICY_DATA_TYPEHASH, vm.eip712HashType(SessionTypes.POLICY_DATA));
        assertEq(ACTION_DATA_TYPEHASH, vm.eip712HashType(SessionTypes.actionData()));
        assertEq(ERC7739_CONTEXT_TYPEHASH, vm.eip712HashType(SessionTypes.ERC7739_CONTEXT));
        assertEq(ERC7739_DATA_TYPEHASH, vm.eip712HashType(SessionTypes.erc7739Data()));
        assertEq(SIGNED_PERMISSIONS_TYPEHASH, vm.eip712HashType(SessionTypes.signedPermissions()));
        assertEq(SESSION_TYPEHASH, vm.eip712HashType(SessionTypes.signedSession()));
        assertEq(CHAIN_SESSION_TYPEHASH, vm.eip712HashType(SessionTypes.chainSession()));
        assertEq(MULTICHAIN_SESSION_TYPEHASH, vm.eip712HashType(SessionTypes.multichainSession()));
    }

    function test_sessionDigest_matchesEIP712HashStruct() public view {
        Session memory session = defaultSession()
            .withUserOpPolicy(address(policy), MockPolicyConfig.allow())
            .withERC7739Content(keccak256("app"), "Mail(address to)")
            .withERC1271Policy(address(policy), MockPolicyConfig.allow())
            .withValidity(10, 20)
            .withPaymaster();

        bytes32 expected = vm.eip712HashStruct(
            SessionTypes.signedSession(), abi.encode(_signed(session, false, false, false))
        );

        assertEq(sessionDigest(address(account), session, SmartSessionMode.ENABLE), expected);
    }

    function test_sessionDigest_flagsFallbackActions() public view {
        Session memory session = defaultSession()
            .withFallbackAction(address(policy), MockPolicyConfig.allow())
            .withModuleCallAction(address(policy), MockPolicyConfig.allow());

        bytes32 expected = vm.eip712HashStruct(
            SessionTypes.signedSession(), abi.encode(_signed(session, true, true, false))
        );

        assertEq(sessionDigest(address(account), session, SmartSessionMode.ENABLE), expected);
    }

    function test_unsafeEnable_setsIgnoreSecurityAttestations() public view {
        Session memory session = defaultSession();

        bytes32 expected = vm.eip712HashStruct(
            SessionTypes.signedSession(), abi.encode(_signed(session, false, false, true))
        );

        assertEq(sessionDigest(address(account), session, SmartSessionMode.UNSAFE_ENABLE), expected);
    }

    function test_sessionDigest_bindsTheEnableNonce() public {
        Session memory session = defaultSession();
        bytes32 before = sessionDigest(address(account), session, SmartSessionMode.ENABLE);
        PermissionId permissionId = smartSession.getPermissionId(session);

        vm.prank(address(account));
        smartSession.revokeEnableSignature(permissionId);

        assertNotEq(sessionDigest(address(account), session, SmartSessionMode.ENABLE), before);
    }

    function testFuzz_multichainDigest_matchesIndependentComputation(
        uint64 chainA,
        bytes32 digestA,
        uint64 chainB,
        bytes32 digestB
    ) public pure {
        ChainDigest[] memory digests = new ChainDigest[](2);
        digests[0] = ChainDigest(chainA, digestA);
        digests[1] = ChainDigest(chainB, digestB);

        assertEq(HashLib.multichainDigest(digests), multichainDigest(digests));
    }

    function _signed(
        Session memory session,
        bool permitGenericPolicy,
        bool permitAdminAccess,
        bool ignoreSecurityAttestations
    ) internal view returns (SignedSession memory) {
        return SignedSession({
            account: address(account),
            permissions: SignedPermissions({
                permitGenericPolicy: permitGenericPolicy,
                permitAdminAccess: permitAdminAccess,
                ignoreSecurityAttestations: ignoreSecurityAttestations,
                permitERC4337Paymaster: session.permitERC4337Paymaster,
                userOpPolicies: session.userOpPolicies,
                erc7739Policies: session.erc7739Policies,
                actions: session.actions
            }),
            sessionValidator: address(session.sessionValidator),
            sessionValidatorInitData: session.sessionValidatorInitData,
            salt: session.salt,
            validAfter: session.validAfter,
            validUntil: session.validUntil,
            smartSession: address(smartSession),
            nonce: smartSession.getNonce(smartSession.getPermissionId(session), address(account))
        });
    }
}
