// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {
    ActionData,
    ActionId,
    ERC7739Context,
    ERC7739Data,
    PermissionId,
    PolicyData,
    PolicyType,
    Session
} from "src/smart-sessions/DataTypes.sol";
import {ISmartSession} from "src/smart-sessions/ISmartSession.sol";

import {ERC7739Signer} from "../../utils/ERC7739Signer.sol";
import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";
import {MockPolicy, MockPolicyConfig} from "../../utils/mocks/MockPolicy.sol";

/// @notice Changing an enabled session's policies changes what the session may do.
contract PolicyManagementTest is SmartSessionTestBase {
    using SessionBuilder for Session;

    bytes4 internal constant INVALID = 0xffffffff;
    bytes32 internal constant APP_DOMAIN = keccak256("app domain");
    string internal constant MAIL = "Mail(address to)";
    string internal constant NOTE = "Note(address to)";

    PermissionId internal permissionId;
    MockPolicy internal secondPolicy;

    function setUp() public override {
        super.setUp();
        permissionId = enableSession(defaultSession());
        secondPolicy = new MockPolicy(true);
    }

    function test_enabledUserOpPolicy_isEnforced() public {
        vm.expectEmit(address(smartSession));
        emit ISmartSession.PolicyEnabled(
            permissionId, PolicyType.USER_OP, address(secondPolicy), address(account)
        );
        vm.prank(address(account));
        smartSession.enableUserOpPolicies(permissionId, _policies(MockPolicyConfig.deny()));

        assertTrue(
            smartSession.isUserOpPolicyEnabled(
                address(account), permissionId, address(secondPolicy)
            )
        );
        _expectPolicyViolation(signUse(userOp(callSetValue(1)), permissionId));
    }

    function test_disabledUserOpPolicy_isNoLongerEnforced() public {
        vm.startPrank(address(account));
        smartSession.enableUserOpPolicies(permissionId, _policies(MockPolicyConfig.deny()));

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
        handleOp(signUse(userOp(callSetValue(3)), permissionId));
        assertEq(target.value(), 3);
    }

    function test_reenabledPolicy_usesItsNewConfig() public {
        vm.startPrank(address(account));
        smartSession.enableUserOpPolicies(permissionId, _policies(MockPolicyConfig.allow()));
        smartSession.enableUserOpPolicies(permissionId, _policies(MockPolicyConfig.deny()));
        vm.stopPrank();

        _expectPolicyViolation(signUse(userOp(callSetValue(1)), permissionId));
    }

    function test_RevertWhen_managingPoliciesOfDisabledPermission() public {
        PermissionId unknown = PermissionId.wrap(keccak256("unknown"));
        PolicyData[] memory policies = _policies(MockPolicyConfig.allow());

        vm.prank(address(account));
        vm.expectRevert(abi.encodeWithSelector(ISmartSession.InvalidPermissionId.selector, unknown));
        smartSession.enableUserOpPolicies(unknown, policies);
    }

    function test_RevertWhen_anotherAccountManagesThePermission() public {
        PolicyData[] memory policies = _policies(MockPolicyConfig.allow());

        vm.prank(makeAddr("stranger"));
        vm.expectRevert(
            abi.encodeWithSelector(ISmartSession.InvalidPermissionId.selector, permissionId)
        );
        smartSession.enableUserOpPolicies(permissionId, policies);
    }

    function test_enabledActionPolicy_permitsTheAction() public {
        bytes4 selector = bytes4(0x12345678);
        ActionData[] memory actions = new ActionData[](1);
        actions[0] = ActionData(selector, address(target), _policies(MockPolicyConfig.allow()));

        vm.prank(address(account));
        smartSession.enableActionPolicies(permissionId, actions);

        ActionId actionId = ActionId.wrap(keccak256(abi.encodePacked(address(target), selector)));
        assertTrue(smartSession.isActionIdEnabled(address(account), permissionId, actionId));
        bytes memory callData = executeSingle(address(target), 0, abi.encodePacked(selector));
        assertEq(validate(signUse(userOp(callData), permissionId)), VALID);
    }

    function test_disablingOneActionPolicy_keepsTheOthersEnforced() public {
        _addActionPolicy(MockPolicyConfig.deny());

        vm.prank(address(account));
        smartSession.disableActionPolicies(
            permissionId, _setValueAction(), _addresses(address(policy))
        );

        assertTrue(
            smartSession.isActionIdEnabled(address(account), permissionId, _setValueAction())
        );
        _expectPolicyViolation(signUse(userOp(callSetValue(1)), permissionId));
    }

    function test_disablingTheLastActionPolicy_disablesTheAction() public {
        vm.expectEmit(address(smartSession));
        emit ISmartSession.ActionIdDisabled(permissionId, _setValueAction(), address(account));
        vm.prank(address(account));
        smartSession.disableActionPolicies(
            permissionId, _setValueAction(), _addresses(address(policy))
        );

        assertFalse(
            smartSession.isActionIdEnabled(address(account), permissionId, _setValueAction())
        );
        _expectNoPolicies(signUse(userOp(callSetValue(1)), permissionId));
    }

    function test_disabledActionId_isNoLongerPermitted() public {
        _addActionPolicy(MockPolicyConfig.allow());

        vm.prank(address(account));
        smartSession.disableActionId(permissionId, _setValueAction());

        _expectNoPolicies(signUse(userOp(callSetValue(1)), permissionId));
    }

    function test_enabledERC1271Policies_permitSigningTheirContent() public {
        ERC7739Signer.AppData memory mail = ERC7739Signer.mail(APP_DOMAIN, makeAddr("recipient"));
        assertEq(_isValidSignature(mail), INVALID);

        ERC7739Data memory data = _erc7739Data(_contents(MAIL));
        vm.prank(address(account));
        smartSession.enableERC1271Policies(permissionId, data);

        assertTrue(
            smartSession.areERC1271PoliciesEnabled(
                address(account), permissionId, data.erc1271Policies
            )
        );
        assertEq(_isValidSignature(mail), EIP1271_MAGIC);
    }

    function test_disabledERC1271Policies_stopSigning() public {
        ERC7739Data memory data = _erc7739Data(_contents(MAIL));
        ERC7739Signer.AppData memory mail = ERC7739Signer.mail(APP_DOMAIN, makeAddr("recipient"));
        vm.startPrank(address(account));
        smartSession.enableERC1271Policies(permissionId, data);
        smartSession.disableERC1271Policies(
            permissionId, _addresses(address(secondPolicy)), data.allowedERC7739Content
        );
        vm.stopPrank();

        assertEq(smartSession.getEnabledERC7739Content(address(account), permissionId).length, 0);
        assertEq(_isValidSignature(mail), INVALID);
    }

    function test_disablingOneContent_keepsTheOthersOfThatDomain() public {
        vm.startPrank(address(account));
        smartSession.enableERC1271Policies(permissionId, _erc7739Data(_contents(MAIL, NOTE)));
        smartSession.disableERC1271Policies(permissionId, new address[](0), _contexts(MAIL));
        vm.stopPrank();

        assertFalse(
            smartSession.isERC7739ContentEnabled(address(account), permissionId, APP_DOMAIN, MAIL)
        );
        assertEq(smartSession.getEnabledERC7739Content(address(account), permissionId).length, 1);
        assertEq(_isValidSignature(ERC7739Signer.mail(APP_DOMAIN, makeAddr("recipient"))), INVALID);
        assertEq(_isValidSignature(_note()), EIP1271_MAGIC);
    }

    function test_permit4337Paymaster_controlsSponsoredOps() public {
        vm.startPrank(address(account));
        smartSession.enableUserOpPolicies(permissionId, _policies(MockPolicyConfig.allow()));
        vm.expectEmit(address(smartSession));
        emit ISmartSession.PermissionIdPermit4337Paymaster(permissionId, address(account), true);
        smartSession.setPermit4337Paymaster(permissionId, true);
        vm.stopPrank();
        ERC4337.PackedUserOperation memory sponsored = userOp(callSetValue(1));
        sponsored.paymasterAndData =
            abi.encodePacked(makeAddr("paymaster"), uint128(1e5), uint128(1e5));
        assertEq(validate(signUse(sponsored, permissionId)), VALID);

        vm.prank(address(account));
        smartSession.setPermit4337Paymaster(permissionId, false);

        vm.expectRevert(
            abi.encodeWithSelector(
                ISmartSession.PaymasterValidationNotEnabled.selector, permissionId
            )
        );
        validate(signUse(sponsored, permissionId));
    }

    function _expectPolicyViolation(ERC4337.PackedUserOperation memory op) internal {
        vm.expectRevert(
            abi.encodeWithSelector(
                ISmartSession.PolicyViolation.selector, permissionId, address(secondPolicy)
            )
        );
        validate(op);
    }

    function _expectNoPolicies(ERC4337.PackedUserOperation memory op) internal {
        vm.expectRevert(abi.encodeWithSelector(ISmartSession.NoPoliciesSet.selector, permissionId));
        validate(op);
    }

    function _addActionPolicy(bytes memory initData) internal {
        ActionData[] memory actions = new ActionData[](1);
        actions[0] = ActionData(SET_VALUE, address(target), _policies(initData));
        vm.prank(address(account));
        smartSession.enableActionPolicies(permissionId, actions);
    }

    function _setValueAction() internal view returns (ActionId) {
        return ActionId.wrap(keccak256(abi.encodePacked(address(target), SET_VALUE)));
    }

    function _isValidSignature(ERC7739Signer.AppData memory app) internal view returns (bytes4) {
        bytes memory signature = ERC7739Signer.sign(app, address(account), permissionId, sessionKey);
        return account.isValidSignature(
            ERC7739Signer.appHash(app), abi.encodePacked(address(smartSession), signature)
        );
    }

    function _note() internal returns (ERC7739Signer.AppData memory) {
        return ERC7739Signer.AppData({
            appDomainSeparator: APP_DOMAIN,
            contents: keccak256(abi.encode(keccak256(bytes(NOTE)), makeAddr("recipient"))),
            contentsType: NOTE,
            contentsName: "Note"
        });
    }

    function _erc7739Data(string[] memory contentNames)
        internal
        view
        returns (ERC7739Data memory data)
    {
        data.allowedERC7739Content = new ERC7739Context[](1);
        data.allowedERC7739Content[0] = ERC7739Context(APP_DOMAIN, contentNames);
        data.erc1271Policies = _policies(MockPolicyConfig.allow());
    }

    function _contexts(string memory contentName)
        internal
        pure
        returns (ERC7739Context[] memory contexts)
    {
        contexts = new ERC7739Context[](1);
        contexts[0] = ERC7739Context(APP_DOMAIN, _contents(contentName));
    }

    function _contents(string memory first) internal pure returns (string[] memory names) {
        names = new string[](1);
        names[0] = first;
    }

    function _contents(string memory first, string memory second)
        internal
        pure
        returns (string[] memory names)
    {
        names = new string[](2);
        names[0] = first;
        names[1] = second;
    }

    function _policies(bytes memory initData) internal view returns (PolicyData[] memory policies) {
        policies = new PolicyData[](1);
        policies[0] = PolicyData(address(secondPolicy), initData);
    }

    function _addresses(address single) internal pure returns (address[] memory list) {
        list = new address[](1);
        list[0] = single;
    }
}
