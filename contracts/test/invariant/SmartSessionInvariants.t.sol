// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {PermissionId} from "src/smart-sessions/DataTypes.sol";
import {ISessionValidator} from "src/smart-sessions/interfaces/ISessionValidator.sol";

import {SmartSessionTestBase} from "../utils/SmartSessionTestBase.sol";
import {MockAccount} from "../utils/mocks/MockAccount.sol";
import {SessionHandler} from "./handlers/SessionHandler.sol";

contract SmartSessionInvariantsTest is SmartSessionTestBase {
    SessionHandler internal handler;

    function setUp() public override {
        super.setUp();
        MockAccount[] memory accounts = new MockAccount[](2);
        accounts[0] = account;
        accounts[1] = new MockAccount(owner);
        installSmartSession(address(accounts[1]), "");

        handler = new SessionHandler(
            smartSession,
            ISessionValidator(address(sessionValidator)),
            address(policy),
            accounts,
            sessionKey
        );
        targetContract(address(handler));
    }

    function invariant_signaturesNeverValidateOtherHashes() public view {
        assertFalse(handler.signatureAcceptedForOtherHash());
    }

    function invariant_signaturesNeverValidateOutsideTheWindow() public view {
        assertFalse(handler.signatureAcceptedOutsideWindow());
    }

    function invariant_removedSessionsLeaveNoValidator() public view {
        for (uint256 i; i < handler.sessionCount(); ++i) {
            SessionHandler.TrackedSession memory tracked = handler.sessionAt(i);
            if (tracked.enabled) continue;

            address account_ = address(tracked.account);
            assertFalse(smartSession.isPermissionEnabled(tracked.permissionId, account_));
            assertFalse(smartSession.isISessionValidatorSet(tracked.permissionId, account_));
        }
    }

    function invariant_enabledSessionsAreListedForTheirAccountOnly() public view {
        for (uint256 i; i < handler.sessionCount(); ++i) {
            SessionHandler.TrackedSession memory tracked = handler.sessionAt(i);
            if (!tracked.enabled) continue;

            assertTrue(
                smartSession.isPermissionEnabled(tracked.permissionId, address(tracked.account))
            );
            assertTrue(_isListed(tracked.permissionId, address(tracked.account)));
            for (uint256 j; j < handler.accountCount(); ++j) {
                address other = address(handler.accounts(j));
                if (other == address(tracked.account)) continue;
                assertFalse(smartSession.isPermissionEnabled(tracked.permissionId, other));
            }
        }
    }

    function invariant_listedCountMatchesEnabledSessions() public view {
        for (uint256 j; j < handler.accountCount(); ++j) {
            address account_ = address(handler.accounts(j));
            uint256 expected;
            for (uint256 i; i < handler.sessionCount(); ++i) {
                SessionHandler.TrackedSession memory tracked = handler.sessionAt(i);
                if (tracked.enabled && address(tracked.account) == account_) ++expected;
            }
            assertEq(smartSession.getPermissionIDs(account_).length, expected);
        }
    }

    function _isListed(PermissionId permissionId, address account_) internal view returns (bool) {
        PermissionId[] memory listed = smartSession.getPermissionIDs(account_);
        for (uint256 i; i < listed.length; ++i) {
            if (PermissionId.unwrap(listed[i]) == PermissionId.unwrap(permissionId)) return true;
        }
        return false;
    }
}
