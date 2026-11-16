// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {PermissionId, Session, SmartSessionMode} from "src/smart-sessions/DataTypes.sol";
import {ISmartSession} from "src/smart-sessions/ISmartSession.sol";

import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";
import {MockAccount} from "../../utils/mocks/MockAccount.sol";

contract ModuleLifecycleTest is SmartSessionTestBase {
    MockAccount internal freshAccount;

    function setUp() public override {
        super.setUp();
        freshAccount = new MockAccount(owner);
    }

    function test_isValidatorModule() public view {
        assertTrue(smartSession.isModuleType(1));
        assertFalse(smartSession.isModuleType(2));
        assertFalse(smartSession.isModuleType(7));
    }

    function test_installWithoutData_enablesNothing() public {
        installSmartSession(address(freshAccount), "");

        assertFalse(smartSession.isInitialized(address(freshAccount)));
    }

    function test_installWithSessions_enablesThem() public {
        Session memory session = defaultSession();

        installSmartSession(address(freshAccount), _installData(SmartSessionMode.ENABLE, session));

        PermissionId permissionId = smartSession.getPermissionId(session);
        assertTrue(smartSession.isPermissionEnabled(permissionId, address(freshAccount)));
        assertTrue(smartSession.isInitialized(address(freshAccount)));
    }

    function test_RevertWhen_installModeIsUse() public {
        bytes memory data = _installData(SmartSessionMode.USE, defaultSession());

        vm.prank(address(freshAccount));
        vm.expectRevert(ISmartSession.InvalidMode.selector);
        freshAccount.installModule(MODULE_TYPE_VALIDATOR, address(smartSession), data);
    }

    function test_RevertWhen_reinstallingWithLeftoverSessions() public {
        enableSession(defaultSession());

        vm.prank(address(account));
        vm.expectRevert(
            abi.encodeWithSelector(
                ISmartSession.SmartSessionModuleAlreadyInstalled.selector, address(account)
            )
        );
        account.installModule(MODULE_TYPE_VALIDATOR, address(smartSession), "");
    }

    function test_uninstall_removesEverySession() public {
        Session memory first = defaultSession();
        Session memory second = defaultSession();
        second.salt = keccak256("second");
        PermissionId firstId = enableSession(first);
        PermissionId secondId = enableSession(second);

        vm.prank(address(account));
        account.uninstallModule(MODULE_TYPE_VALIDATOR, address(smartSession), "");

        assertFalse(smartSession.isPermissionEnabled(firstId, address(account)));
        assertFalse(smartSession.isPermissionEnabled(secondId, address(account)));
        assertFalse(smartSession.isInitialized(address(account)));
    }

    function test_reinstallAfterUninstall_succeeds() public {
        enableSession(defaultSession());
        vm.startPrank(address(account));
        account.uninstallModule(MODULE_TYPE_VALIDATOR, address(smartSession), "");
        account.installModule(MODULE_TYPE_VALIDATOR, address(smartSession), "");
        vm.stopPrank();

        assertFalse(smartSession.isInitialized(address(account)));
    }

    function _installData(SmartSessionMode mode, Session memory session)
        internal
        pure
        returns (bytes memory)
    {
        Session[] memory sessions = new Session[](1);
        sessions[0] = session;
        return abi.encodePacked(mode, abi.encode(sessions));
    }
}
