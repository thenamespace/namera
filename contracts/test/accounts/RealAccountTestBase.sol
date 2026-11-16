// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {PermissionId, Session} from "src/smart-sessions/DataTypes.sol";
import {ISmartSession} from "src/smart-sessions/ISmartSession.sol";

import {AccountFixtures} from "../utils/AccountFixtures.sol";
import {IERC5267} from "../utils/ERC7739Signer.sol";
import {SmartSessionTestBase} from "../utils/SmartSessionTestBase.sol";

/// @notice SmartSession on a real deployed account implementation (loaded from fixtures). Each account test
/// supplies how to deploy the account with SmartSession installed, its nonce key layout and its owner ERC-1271
/// signature format; the session flows below run unchanged on every account.
abstract contract RealAccountTestBase is SmartSessionTestBase {
    address internal smartAccount;

    /// @dev Deploys the account for `owner` with SmartSession installed as a validator.
    function deployAccount() internal virtual returns (address);

    function setUp() public virtual override {
        super.setUp();
        AccountFixtures.install();
        smartAccount = deployAccount();
        vm.label(smartAccount, "smartAccount");
        vm.deal(smartAccount, 100 ether);
    }

    /// @dev EIP-712 domain separator of `account`, from its ERC-5267 `eip712Domain()`.
    function accountDomainSeparator(address account) internal view returns (bytes32) {
        (
            ,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,,
        ) = IERC5267(account).eip712Domain();
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );
    }

    function test_enableModeExecutesThroughEntryPoint() public {
        handleOp(signEnable(userOp(smartAccount, callSetValue(11)), defaultSession()));

        assertEq(target.value(), 11);
        assertTrue(
            smartSession.isPermissionEnabled(
                smartSession.getPermissionId(defaultSession()), smartAccount
            )
        );
    }

    function test_useModeAfterEnable() public {
        handleOp(signEnable(userOp(smartAccount, callSetValue(1)), defaultSession()));
        PermissionId permissionId = smartSession.getPermissionId(defaultSession());

        handleOp(signUse(userOp(smartAccount, callSetValue(2)), permissionId));

        assertEq(target.value(), 2);
        assertEq(target.calls(), 2);
    }

    function test_removedSessionIsRejected() public {
        handleOp(signEnable(userOp(smartAccount, callSetValue(1)), defaultSession()));
        PermissionId permissionId = smartSession.getPermissionId(defaultSession());
        vm.prank(smartAccount);
        smartSession.removeSession(permissionId);
        ERC4337.PackedUserOperation memory op =
            signUse(userOp(smartAccount, callSetValue(2)), permissionId);

        vm.expectRevert();
        handleOp(op);
    }

    function test_actionWithoutPolicyIsRejected() public {
        handleOp(signEnable(userOp(smartAccount, callSetValue(1)), defaultSession()));
        PermissionId permissionId = smartSession.getPermissionId(defaultSession());
        ERC4337.PackedUserOperation memory op =
            signUse(userOp(smartAccount, executeSingle(makeAddr("unlisted"), 0, "")), permissionId);

        vm.expectRevert();
        handleOp(op);
    }

    function test_wrongOwnerSignatureIsRejected() public {
        Session memory session = defaultSession();
        ownerKey = uint256(keccak256("not the owner"));
        ERC4337.PackedUserOperation memory op =
            signEnable(userOp(smartAccount, callSetValue(1)), session);

        vm.expectRevert();
        handleOp(op);
        assertFalse(
            smartSession.isPermissionEnabled(smartSession.getPermissionId(session), smartAccount)
        );
    }

    function test_smartSessionIsInstalled() public view {
        assertTrue(ISmartSession(address(smartSession)).isModuleType(1));
        assertEq(smartSession.getPermissionIDs(smartAccount).length, 0);
    }
}
