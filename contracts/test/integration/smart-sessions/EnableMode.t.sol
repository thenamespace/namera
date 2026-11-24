// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {
    ChainDigest,
    EnableSession,
    PermissionId,
    Session,
    SmartSessionMode
} from "src/smart-sessions/DataTypes.sol";
import {ISmartSession} from "src/smart-sessions/ISmartSession.sol";

import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";
import {MockPolicyConfig} from "../../utils/mocks/MockPolicy.sol";

contract EnableModeTest is SmartSessionTestBase {
    using SessionBuilder for Session;

    function test_enablesSessionAndExecutesInOneUserOp() public {
        Session memory session = defaultSession();
        PermissionId permissionId = smartSession.getPermissionId(session);

        handleOp(signEnable(userOp(callSetValue(5)), session));

        assertTrue(smartSession.isPermissionEnabled(permissionId, address(account)));
        assertEq(target.value(), 5);
    }

    /// @dev Enabling in a user operation emits what enabling directly does, so indexers see every session.
    function test_enableMode_emitsTheEnablingEvents() public {
        Session memory session = defaultSession();
        PermissionId permissionId = smartSession.getPermissionId(session);
        ERC4337.PackedUserOperation memory op = signEnable(userOp(callSetValue(5)), session);

        vm.expectEmit(address(smartSession));
        emit ISmartSession.NonceIterated(permissionId, address(account), 1);
        vm.expectEmit(address(smartSession));
        emit ISmartSession.SessionCreated(permissionId, address(account));
        handleOp(op);
    }

    function test_unsafeEnableMode_isAccepted() public {
        Session memory session = defaultSession();

        handleOp(signEnable(userOp(callSetValue(1)), session, SmartSessionMode.UNSAFE_ENABLE));

        assertTrue(
            smartSession.isPermissionEnabled(
                smartSession.getPermissionId(session), address(account)
            )
        );
    }

    function test_RevertWhen_ownerSignatureIsInvalid() public {
        Session memory session = defaultSession();
        ERC4337.PackedUserOperation memory op = userOp(callSetValue(1));
        EnableSession memory data = enableData(address(account), session, SmartSessionMode.ENABLE);
        (, uint256 otherKey) = makeAddrAndKey("notOwner");
        bytes32 digest = multichainDigest(data.hashesAndChainIds);
        data.permissionEnableSig = signRaw(otherKey, digest);
        op.signature = _encode(data, op);

        vm.expectRevert(
            abi.encodeWithSelector(
                ISmartSession.InvalidEnableSignature.selector, address(account), digest
            )
        );
        validate(op);
    }

    function test_RevertWhen_enableDataIsReplayed() public {
        Session memory session = defaultSession();
        EnableSession memory data = enableData(address(account), session, SmartSessionMode.ENABLE);
        ERC4337.PackedUserOperation memory first = userOp(callSetValue(1));
        first.signature = _encode(data, first);
        handleOp(first);

        ERC4337.PackedUserOperation memory replay = userOp(callSetValue(2));
        replay.signature = _encode(data, replay);

        vm.expectPartialRevert(ISmartSession.HashMismatch.selector);
        validate(replay);
    }

    function test_RevertWhen_enableSignatureWasRevoked() public {
        Session memory session = defaultSession();
        PermissionId permissionId = smartSession.getPermissionId(session);
        EnableSession memory data = enableData(address(account), session, SmartSessionMode.ENABLE);
        vm.prank(address(account));
        smartSession.revokeEnableSignature(permissionId);
        ERC4337.PackedUserOperation memory op = userOp(callSetValue(1));
        op.signature = _encode(data, op);

        vm.expectPartialRevert(ISmartSession.HashMismatch.selector);
        validate(op);
    }

    /// @dev Removing a session revokes owner enable signatures that were never used.
    function test_RevertWhen_removedSessionIsEnabledWithAnUnusedSignature() public {
        Session memory session = defaultSession();
        EnableSession memory data = enableData(address(account), session, SmartSessionMode.ENABLE);
        PermissionId permissionId = enableSession(session);
        vm.prank(address(account));
        smartSession.removeSession(permissionId);
        ERC4337.PackedUserOperation memory op = userOp(callSetValue(1));
        op.signature = _encode(data, op);

        vm.expectPartialRevert(ISmartSession.HashMismatch.selector);
        validate(op);
    }

    function testFuzz_RevertWhen_chainIdDoesNotMatch(uint64 chainId) public {
        vm.assume(chainId != block.chainid);
        Session memory session = defaultSession();
        EnableSession memory data = enableData(address(account), session, SmartSessionMode.ENABLE);
        data.hashesAndChainIds[0].chainId = chainId;
        ERC4337.PackedUserOperation memory op = userOp(callSetValue(1));
        op.signature = _encode(data, op);

        vm.expectRevert(abi.encodeWithSelector(ISmartSession.ChainIdMismatch.selector, chainId));
        validate(op);
    }

    function test_RevertWhen_sessionDiffersFromSignedDigest() public {
        Session memory session = defaultSession();
        EnableSession memory data = enableData(address(account), session, SmartSessionMode.ENABLE);
        data.sessionToEnable = session.withUserOpPolicy(address(policy), MockPolicyConfig.allow());
        ERC4337.PackedUserOperation memory op = userOp(callSetValue(1));
        op.signature = _encode(data, op);

        vm.expectPartialRevert(ISmartSession.HashMismatch.selector);
        validate(op);
    }

    function test_multichainEnable_usesThisChainsEntry() public {
        Session memory session = defaultSession();
        ChainDigest[] memory digests = new ChainDigest[](2);
        digests[0] = ChainDigest({chainId: 1, sessionDigest: keccak256("mainnet session")});
        digests[1] = ChainDigest({
            chainId: uint64(block.chainid),
            sessionDigest: sessionDigest(address(account), session, SmartSessionMode.ENABLE)
        });
        EnableSession memory data = EnableSession({
            chainDigestIndex: 1,
            hashesAndChainIds: digests,
            sessionToEnable: session,
            permissionEnableSig: signRaw(ownerKey, multichainDigest(digests))
        });
        ERC4337.PackedUserOperation memory op = userOp(callSetValue(9));
        op.signature = _encode(data, op);

        handleOp(op);

        assertEq(target.value(), 9);
    }

    function test_enableOnExistingPermission_addsPoliciesAndKeepsValidator() public {
        Session memory session = defaultSession();
        PermissionId permissionId = enableSession(session);
        Session memory extended =
            session.withUserOpPolicy(address(policy), MockPolicyConfig.allow());

        handleOp(signEnable(userOp(callSetValue(1)), extended));

        assertEq(
            PermissionId.unwrap(smartSession.getPermissionId(extended)),
            PermissionId.unwrap(permissionId)
        );
        assertTrue(
            smartSession.isUserOpPolicyEnabled(address(account), permissionId, address(policy))
        );
        (address validator,) =
            smartSession.getSessionValidatorAndConfig(address(account), permissionId);
        assertEq(validator, address(sessionValidator));
    }

    function test_invalidSessionKeySignature_failsAfterEnabling() public {
        Session memory session = defaultSession();
        EnableSession memory data = enableData(address(account), session, SmartSessionMode.ENABLE);
        ERC4337.PackedUserOperation memory op = userOp(callSetValue(1));
        (, uint256 otherKey) = makeAddrAndKey("other");
        op.signature = encodeEnableSignature(
            SmartSessionMode.ENABLE,
            data,
            signUserOpHash(op, smartSession.getPermissionId(session), otherKey)
        );

        assertEq(validate(op), SIG_FAILED);
    }

    function test_RevertWhen_validityWindowIsInverted() public {
        Session memory session = defaultSession().withValidity(200, 100);
        ERC4337.PackedUserOperation memory op = signEnable(userOp(callSetValue(1)), session);

        vm.expectRevert(
            abi.encodeWithSelector(ISmartSession.InvalidSessionValidity.selector, 200, 100)
        );
        validate(op);
    }

    function _encode(EnableSession memory data, ERC4337.PackedUserOperation memory op)
        internal
        view
        returns (bytes memory)
    {
        PermissionId permissionId = smartSession.getPermissionId(data.sessionToEnable);
        return encodeEnableSignature(
            SmartSessionMode.ENABLE, data, signUserOpHash(op, permissionId, sessionKey)
        );
    }
}
