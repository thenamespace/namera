// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {
    ActionData,
    ActionId,
    ConfigId,
    ERC7739Context,
    ERC7739Data,
    PermissionId,
    PolicyData,
    PolicyType,
    Session
} from "src/smart-sessions/DataTypes.sol";
import {ISmartSession} from "src/smart-sessions/ISmartSession.sol";

import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";
import {MockPolicy, MockPolicyConfig} from "../../utils/mocks/MockPolicy.sol";

contract PolicyManagementTest is SmartSessionTestBase {
    using SessionBuilder for Session;

    bytes32 internal constant APP_DOMAIN = keccak256("app domain");
    string internal constant CONTENT = "Mail(address to)";
    string internal constant OTHER_CONTENT = "Note(string text)";

    PermissionId internal permissionId;
    MockPolicy internal secondPolicy;

    function setUp() public override {
        super.setUp();
        permissionId = enableSession(defaultSession());
        secondPolicy = new MockPolicy(true);
    }

    function test_enableUserOpPolicies_addsPolicy() public {
        vm.expectEmit(address(smartSession));
        emit ISmartSession.PolicyEnabled(
            permissionId, PolicyType.USER_OP, address(secondPolicy), address(account)
        );
        vm.prank(address(account));
        smartSession.enableUserOpPolicies(permissionId, _policies(secondPolicy));

        assertTrue(
            smartSession.isUserOpPolicyEnabled(
                address(account), permissionId, address(secondPolicy)
            )
        );
    }

    function test_disableUserOpPolicies_removesPolicy() public {
        vm.startPrank(address(account));
        smartSession.enableUserOpPolicies(permissionId, _policies(secondPolicy));

        vm.expectEmit(address(smartSession));
        emit ISmartSession.PolicyDisabled(
            permissionId, PolicyType.USER_OP, address(secondPolicy), address(account)
        );
        smartSession.disableUserOpPolicies(permissionId, _addresses(address(secondPolicy)));
        vm.stopPrank();

        assertFalse(
            smartSession.isUserOpPolicyEnabled(
                address(account), permissionId, address(secondPolicy)
            )
        );
    }

    function test_RevertWhen_managingPoliciesOfDisabledPermission() public {
        PermissionId unknown = PermissionId.wrap(keccak256("unknown"));
        PolicyData[] memory policies = _policies(secondPolicy);

        vm.prank(address(account));
        vm.expectRevert(abi.encodeWithSelector(ISmartSession.InvalidPermissionId.selector, unknown));
        smartSession.enableUserOpPolicies(unknown, policies);
    }

    function test_RevertWhen_anotherAccountManagesThePermission() public {
        PolicyData[] memory policies = _policies(secondPolicy);

        vm.prank(makeAddr("stranger"));
        vm.expectRevert(
            abi.encodeWithSelector(ISmartSession.InvalidPermissionId.selector, permissionId)
        );
        smartSession.enableUserOpPolicies(permissionId, policies);
    }

    function test_enableActionPolicies_addsAction() public {
        ActionData[] memory actions = new ActionData[](1);
        actions[0] = ActionData(bytes4(0x12345678), address(target), _policies(secondPolicy));

        vm.prank(address(account));
        smartSession.enableActionPolicies(permissionId, actions);

        ActionId actionId = _actionId(address(target), bytes4(0x12345678));
        assertTrue(smartSession.isActionIdEnabled(address(account), permissionId, actionId));
        assertTrue(
            smartSession.isActionPolicyEnabled(
                address(account), permissionId, actionId, address(secondPolicy)
            )
        );
    }

    function test_disableActionPolicies_keepsActionWhilePoliciesRemain() public {
        ActionId actionId = _actionId(address(target), SET_VALUE);
        _addActionPolicy(secondPolicy);

        vm.prank(address(account));
        smartSession.disableActionPolicies(permissionId, actionId, _addresses(address(policy)));

        assertTrue(smartSession.isActionIdEnabled(address(account), permissionId, actionId));
        assertEq(
            smartSession.getActionPolicies(address(account), permissionId, actionId)[0],
            address(secondPolicy)
        );
    }

    function test_disableActionPolicies_disablesActionWithoutPolicies() public {
        ActionId actionId = _actionId(address(target), SET_VALUE);

        vm.expectEmit(address(smartSession));
        emit ISmartSession.ActionIdDisabled(permissionId, actionId, address(account));
        vm.prank(address(account));
        smartSession.disableActionPolicies(permissionId, actionId, _addresses(address(policy)));

        assertFalse(smartSession.isActionIdEnabled(address(account), permissionId, actionId));
    }

    function test_disableActionId_removesActionAndPolicies() public {
        ActionId actionId = _actionId(address(target), SET_VALUE);
        _addActionPolicy(secondPolicy);

        vm.prank(address(account));
        smartSession.disableActionId(permissionId, actionId);

        assertFalse(smartSession.isActionIdEnabled(address(account), permissionId, actionId));
        assertEq(smartSession.getActionPolicies(address(account), permissionId, actionId).length, 0);
    }

    function test_enableERC1271Policies_addsContentAndPolicies() public {
        vm.prank(address(account));
        smartSession.enableERC1271Policies(permissionId, _erc7739Data());

        assertTrue(
            smartSession.isERC7739ContentEnabled(
                address(account), permissionId, APP_DOMAIN, CONTENT
            )
        );
        assertTrue(
            smartSession.isERC1271PolicyEnabled(
                address(account), permissionId, address(secondPolicy)
            )
        );
    }

    function test_disableERC1271Policies_removesContentAndPolicies() public {
        ERC7739Data memory data = _erc7739Data();
        vm.startPrank(address(account));
        smartSession.enableERC1271Policies(permissionId, data);
        smartSession.disableERC1271Policies(
            permissionId, _addresses(address(secondPolicy)), data.allowedERC7739Content
        );
        vm.stopPrank();

        assertFalse(
            smartSession.isERC7739ContentEnabled(
                address(account), permissionId, APP_DOMAIN, CONTENT
            )
        );
        assertEq(smartSession.getEnabledERC7739Content(address(account), permissionId).length, 0);
        assertEq(smartSession.getERC1271Policies(address(account), permissionId).length, 0);
    }

    function test_disablingOneContent_keepsTheOthersOfThatDomain() public {
        ERC7739Data memory data = _erc7739Data();
        string[] memory names = new string[](2);
        names[0] = CONTENT;
        names[1] = OTHER_CONTENT;
        data.allowedERC7739Content[0].contentNames = names;
        ERC7739Context[] memory removed = new ERC7739Context[](1);
        removed[0] = ERC7739Context(APP_DOMAIN, new string[](1));
        removed[0].contentNames[0] = CONTENT;

        vm.startPrank(address(account));
        smartSession.enableERC1271Policies(permissionId, data);
        smartSession.disableERC1271Policies(permissionId, new address[](0), removed);
        vm.stopPrank();

        assertFalse(
            smartSession.isERC7739ContentEnabled(
                address(account), permissionId, APP_DOMAIN, CONTENT
            )
        );
        assertTrue(
            smartSession.isERC7739ContentEnabled(
                address(account), permissionId, APP_DOMAIN, OTHER_CONTENT
            )
        );
        assertEq(smartSession.getEnabledERC7739Content(address(account), permissionId).length, 1);
    }

    function test_setPermit4337Paymaster_togglesPermission() public {
        vm.expectEmit(address(smartSession));
        emit ISmartSession.PermissionIdPermit4337Paymaster(permissionId, address(account), true);
        vm.prank(address(account));
        smartSession.setPermit4337Paymaster(permissionId, true);
    }

    function test_reenablingPolicy_reinitializesItsConfig() public {
        vm.startPrank(address(account));
        smartSession.enableUserOpPolicies(permissionId, _policies(secondPolicy));
        PolicyData[] memory denying = new PolicyData[](1);
        denying[0] = PolicyData(address(secondPolicy), MockPolicyConfig.deny());
        smartSession.enableUserOpPolicies(permissionId, denying);
        vm.stopPrank();

        (uint256 validationData,,) =
            secondPolicy.configs(_userOpConfigId(), address(smartSession), address(account));
        assertEq(validationData, 1);
    }

    function _addActionPolicy(MockPolicy extra) internal {
        ActionData[] memory actions = new ActionData[](1);
        actions[0] = ActionData(SET_VALUE, address(target), _policies(extra));
        vm.prank(address(account));
        smartSession.enableActionPolicies(permissionId, actions);
    }

    function _erc7739Data() internal view returns (ERC7739Data memory data) {
        string[] memory names = new string[](1);
        names[0] = CONTENT;
        data.allowedERC7739Content = new ERC7739Context[](1);
        data.allowedERC7739Content[0] = ERC7739Context(APP_DOMAIN, names);
        data.erc1271Policies = _policies(secondPolicy);
    }

    function _policies(MockPolicy mock) internal pure returns (PolicyData[] memory policies) {
        policies = new PolicyData[](1);
        policies[0] = PolicyData(address(mock), MockPolicyConfig.allow());
    }

    function _addresses(address single) internal pure returns (address[] memory list) {
        list = new address[](1);
        list[0] = single;
    }

    function _actionId(address actionTarget, bytes4 selector) internal pure returns (ActionId) {
        return ActionId.wrap(keccak256(abi.encodePacked(actionTarget, selector)));
    }

    function _userOpConfigId() internal view returns (ConfigId) {
        return ConfigId.wrap(keccak256(abi.encodePacked(address(account), permissionId)));
    }
}
