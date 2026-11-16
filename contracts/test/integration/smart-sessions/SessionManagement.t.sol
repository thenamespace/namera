// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {
    ActionId,
    ERC7739Context,
    ERC7739ContextHashes,
    PermissionId,
    PolicyData,
    Session
} from "src/smart-sessions/DataTypes.sol";
import {ISmartSession} from "src/smart-sessions/ISmartSession.sol";
import {ISessionValidator} from "src/smart-sessions/interfaces/ISessionValidator.sol";
import {FlatBytesLib} from "src/smart-sessions/lib/FlatBytesLib.sol";
import {IdLib} from "src/smart-sessions/lib/IdLib.sol";

import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";
import {MockAccount} from "../../utils/mocks/MockAccount.sol";
import {MockPolicy, MockPolicyConfig} from "../../utils/mocks/MockPolicy.sol";

contract SessionManagementTest is SmartSessionTestBase {
    using SessionBuilder for Session;

    bytes32 internal constant APP_DOMAIN = keccak256("app domain");
    string internal constant CONTENT = "Mail(address to)";

    function test_enableSessions_returnsPermissionIds() public {
        Session[] memory sessions = new Session[](2);
        sessions[0] = defaultSession();
        sessions[1] = defaultSession();
        sessions[1].salt = keccak256("second");

        vm.prank(address(account));
        PermissionId[] memory ids = smartSession.enableSessions(sessions);

        assertEq(ids.length, 2);
        for (uint256 i; i < 2; ++i) {
            assertEq(
                PermissionId.unwrap(ids[i]),
                PermissionId.unwrap(smartSession.getPermissionId(sessions[i]))
            );
            assertTrue(smartSession.isPermissionEnabled(ids[i], address(account)));
        }
        assertEq(smartSession.getPermissionIDs(address(account)).length, 2);
    }

    function test_enableSessions_storesValidatorAndConfig() public {
        Session memory session = defaultSession();
        PermissionId permissionId = enableSession(session);

        (address validator, bytes memory config) =
            smartSession.getSessionValidatorAndConfig(address(account), permissionId);

        assertEq(validator, address(sessionValidator));
        assertEq(config, session.sessionValidatorInitData);
        assertTrue(smartSession.isISessionValidatorSet(permissionId, address(account)));
    }

    function test_enableSessions_storesPoliciesAndActions() public {
        Session memory session =
            defaultSession().withUserOpPolicy(address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);

        assertEq(smartSession.getUserOpPolicies(address(account), permissionId)[0], address(policy));
        assertTrue(
            smartSession.areUserOpPoliciesEnabled(
                address(account), permissionId, session.userOpPolicies
            )
        );
        assertTrue(smartSession.areActionsEnabled(address(account), permissionId, session.actions));
        assertEq(smartSession.getEnabledActions(address(account), permissionId).length, 1);
    }

    function test_enableSessions_storesERC7739ContentAndPolicies() public {
        Session memory session = defaultSession()
            .withERC7739Content(APP_DOMAIN, CONTENT)
            .withERC1271Policy(address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);

        ERC7739ContextHashes[] memory contents =
            smartSession.getEnabledERC7739Content(address(account), permissionId);

        assertEq(contents.length, 1);
        assertEq(contents[0].appDomainSeparator, APP_DOMAIN);
        assertEq(contents[0].contentNameHashes[0], keccak256(bytes(CONTENT)));
        assertTrue(
            smartSession.isERC7739ContentEnabled(
                address(account), permissionId, APP_DOMAIN, CONTENT
            )
        );
        assertEq(
            smartSession.getERC1271Policies(address(account), permissionId)[0], address(policy)
        );
    }

    function test_enableSessions_storesValidityWindow() public {
        PermissionId permissionId = enableSession(defaultSession().withValidity(100, 200));

        (uint48 validAfter, uint48 validUntil) =
            smartSession.getSessionValidity(permissionId, address(account));

        assertEq(validAfter, 100);
        assertEq(validUntil, 200);
    }

    function test_RevertWhen_noSessionsAreGiven() public {
        vm.prank(address(account));
        vm.expectRevert(ISmartSession.InvalidData.selector);
        smartSession.enableSessions(new Session[](0));
    }

    function test_RevertWhen_policyDoesNotSupportItsType() public {
        MockPolicy silentPolicy = new MockPolicy(false);
        Session memory session =
            defaultSession().withUserOpPolicy(address(silentPolicy), MockPolicyConfig.allow());

        vm.expectRevert(
            abi.encodeWithSelector(ISmartSession.UnsupportedPolicy.selector, address(silentPolicy))
        );
        enableSession(session);
    }

    function test_RevertWhen_sessionValidatorIsMissing() public {
        Session memory session = defaultSession();
        session.sessionValidator = ISessionValidator(address(0));

        vm.expectRevert(
            abi.encodeWithSelector(ISmartSession.InvalidISessionValidator.selector, address(0))
        );
        enableSession(session);
    }

    function test_RevertWhen_actionTargetsZeroAddress() public {
        Session memory session = _withoutActions()
            .withAction(address(0), SET_VALUE, address(policy), MockPolicyConfig.allow());

        vm.expectRevert(ISmartSession.InvalidActionId.selector);
        enableSession(session);
    }

    function test_RevertWhen_actionTargetsTheModule() public {
        Session memory session = _withoutActions()
            .withAction(address(smartSession), SET_VALUE, address(policy), MockPolicyConfig.allow());

        vm.expectRevert(ISmartSession.InvalidActionId.selector);
        enableSession(session);
    }

    function test_RevertWhen_validatorConfigExceedsCapacity() public {
        Session memory session = defaultSession();
        session.sessionValidatorInitData = new bytes(FlatBytesLib.MAX_LENGTH + 1);

        vm.expectRevert(
            abi.encodeWithSelector(FlatBytesLib.DataTooLong.selector, FlatBytesLib.MAX_LENGTH + 1)
        );
        enableSession(session);
    }

    function test_removeSession_clearsAllSessionState() public {
        Session memory session = defaultSession()
            .withUserOpPolicy(address(policy), MockPolicyConfig.allow())
            .withERC7739Content(APP_DOMAIN, CONTENT)
            .withERC1271Policy(address(policy), MockPolicyConfig.allow())
            .withValidity(1, 1000)
            .withPaymaster();
        PermissionId permissionId = enableSession(session);

        vm.prank(address(account));
        smartSession.removeSession(permissionId);

        assertFalse(smartSession.isPermissionEnabled(permissionId, address(account)));
        assertFalse(smartSession.isISessionValidatorSet(permissionId, address(account)));
        assertEq(smartSession.getUserOpPolicies(address(account), permissionId).length, 0);
        assertEq(smartSession.getERC1271Policies(address(account), permissionId).length, 0);
        assertEq(smartSession.getEnabledActions(address(account), permissionId).length, 0);
        assertFalse(
            smartSession.isActionPolicyEnabled(
                address(account),
                permissionId,
                IdLib.toActionId(address(target), SET_VALUE),
                address(policy)
            )
        );
        assertEq(smartSession.getEnabledERC7739Content(address(account), permissionId).length, 0);
        (, bytes memory config) =
            smartSession.getSessionValidatorAndConfig(address(account), permissionId);
        assertEq(config.length, 0);
        (uint48 validAfter, uint48 validUntil) =
            smartSession.getSessionValidity(permissionId, address(account));
        assertEq(validAfter + validUntil, 0);
        assertEq(smartSession.getNonce(permissionId, address(account)), 1);
    }

    function test_removedSession_cannotValidate() public {
        PermissionId permissionId = enableSession(defaultSession());
        vm.prank(address(account));
        smartSession.removeSession(permissionId);
        ERC4337.PackedUserOperation memory op = signUse(userOp(callSetValue(1)), permissionId);

        vm.expectRevert(
            abi.encodeWithSelector(ISmartSession.InvalidPermissionId.selector, permissionId)
        );
        validate(op);
    }

    function test_removedSession_canBeEnabledAgain() public {
        Session memory session = defaultSession();
        PermissionId permissionId = enableSession(session);
        vm.prank(address(account));
        smartSession.removeSession(permissionId);

        enableSession(session);

        handleOp(signUse(userOp(callSetValue(4)), permissionId));
        assertEq(target.value(), 4);
    }

    function test_RevertWhen_removingTheEmptyPermissionId() public {
        vm.prank(address(account));
        vm.expectRevert(
            abi.encodeWithSelector(ISmartSession.InvalidSession.selector, PermissionId.wrap(0))
        );
        smartSession.removeSession(PermissionId.wrap(0));
    }

    function test_revokeEnableSignature_incrementsNonce() public {
        PermissionId permissionId = smartSession.getPermissionId(defaultSession());
        vm.startPrank(address(account));
        for (uint256 expected = 1; expected <= 2; ++expected) {
            vm.expectEmit(address(smartSession));
            emit ISmartSession.NonceIterated(permissionId, address(account), expected);
            smartSession.revokeEnableSignature(permissionId);
        }
        vm.stopPrank();

        assertEq(smartSession.getNonce(permissionId, address(account)), 2);
    }

    function test_sessionsAreIsolatedPerAccount() public {
        MockAccount other = new MockAccount(owner);
        installSmartSession(address(other), "");
        PermissionId permissionId = enableSession(defaultSession());

        assertFalse(smartSession.isPermissionEnabled(permissionId, address(other)));
        assertEq(smartSession.getPermissionIDs(address(other)).length, 0);
    }

    function test_areEnabled_isFalseForUnknownPolicies() public {
        PermissionId permissionId = enableSession(defaultSession());
        PolicyData[] memory unknown = new PolicyData[](1);
        unknown[0] = PolicyData(makeAddr("unknown"), "");

        assertFalse(smartSession.areUserOpPoliciesEnabled(address(account), permissionId, unknown));
        assertTrue(
            smartSession.areUserOpPoliciesEnabled(
                address(account), permissionId, new PolicyData[](0)
            )
        );
    }

    function test_areERC1271PoliciesEnabled_reflectsEnabledPolicies() public {
        Session memory session =
            defaultSession().withERC1271Policy(address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);

        assertTrue(
            smartSession.areERC1271PoliciesEnabled(
                address(account), permissionId, session.erc7739Policies.erc1271Policies
            )
        );
    }

    function test_areActionsEnabled_isFalseForActionWithUnknownPolicy() public {
        Session memory session = defaultSession();
        PermissionId permissionId = enableSession(session);
        session.actions[0].actionPolicies[0].policy = makeAddr("unknown");

        assertFalse(smartSession.areActionsEnabled(address(account), permissionId, session.actions));
    }

    function test_policyViews_areFalseForPoliciesNotEnabled() public {
        Session memory session =
            defaultSession().withERC1271Policy(address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);
        address unknown = makeAddr("unknown");
        PolicyData[] memory unknownPolicies = new PolicyData[](1);
        unknownPolicies[0] = PolicyData(unknown, "");
        ActionId actionId = IdLib.toActionId(address(target), SET_VALUE);

        assertTrue(
            smartSession.isERC1271PolicyEnabled(address(account), permissionId, address(policy))
        );
        assertFalse(smartSession.isERC1271PolicyEnabled(address(account), permissionId, unknown));
        assertFalse(
            smartSession.areERC1271PoliciesEnabled(address(account), permissionId, unknownPolicies)
        );
        assertTrue(
            smartSession.isActionPolicyEnabled(
                address(account), permissionId, actionId, address(policy)
            )
        );
        assertFalse(
            smartSession.isActionPolicyEnabled(address(account), permissionId, actionId, unknown)
        );
    }

    function test_contextWithoutContentNames_enablesNoContent() public {
        Session memory session = defaultSession();
        session.erc7739Policies.allowedERC7739Content = new ERC7739Context[](1);
        session.erc7739Policies.allowedERC7739Content[0] =
            ERC7739Context(APP_DOMAIN, new string[](0));
        PermissionId permissionId = enableSession(session);

        assertEq(smartSession.getEnabledERC7739Content(address(account), permissionId).length, 0);
    }

    function _withoutActions() internal view returns (Session memory) {
        return SessionBuilder.create(
            ISessionValidator(address(sessionValidator)),
            SessionBuilder.ecdsaConfig(sessionSigner),
            keccak256("no actions")
        );
    }
}
