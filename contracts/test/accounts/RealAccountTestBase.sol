// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {PermissionId, Session} from "src/smart-sessions/DataTypes.sol";

import {SessionHook} from "src/hooks/SessionHook.sol";
import {AllowPolicy} from "src/policies/AllowPolicy.sol";
import {SpendPolicy} from "src/policies/SpendPolicy.sol";
import {ISessionValidator} from "src/smart-sessions/interfaces/ISessionValidator.sol";

import {AccountFixtures} from "../utils/AccountFixtures.sol";
import {IERC5267} from "../utils/ERC7739Signer.sol";
import {IEntryPoint} from "../utils/EntryPoint.sol";
import {PolicyCalls} from "../utils/PolicyCalls.sol";
import {SessionBuilder} from "../utils/SessionBuilder.sol";
import {SmartSessionTestBase} from "../utils/SmartSessionTestBase.sol";
import {MockERC20} from "../utils/mocks/MockERC20.sol";

/// @notice SmartSession on a real deployed account implementation (loaded from fixtures). Each account test
/// supplies how to deploy the account with SmartSession installed, its nonce key layout and its owner ERC-1271
/// signature format; the session flows below run unchanged on every account.
abstract contract RealAccountTestBase is SmartSessionTestBase {
    using SessionBuilder for Session;

    address internal smartAccount;
    SessionHook internal sessionHook;

    /// @dev Deploys the account for `owner` with SmartSession installed as a validator, and SessionHook when
    /// `withSessionHook()`.
    function deployAccount() internal virtual returns (address);

    /// @dev Whether the account is deployed with SessionHook running for SmartSession's operations.
    function withSessionHook() internal pure virtual returns (bool) {
        return false;
    }

    function setUp() public virtual override {
        super.setUp();
        AccountFixtures.install();
        sessionHook = new SessionHook();
        vm.label(address(sessionHook), "SessionHook");
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

    function test_useModeAfterEnable() public {
        handleOp(signEnable(userOp(smartAccount, callSetValue(1)), defaultSession()));
        PermissionId permissionId = smartSession.getPermissionId(defaultSession());

        handleOp(signUse(userOp(smartAccount, callSetValue(2)), permissionId));

        assertEq(target.value(), 2);
        assertEq(target.calls(), 2);
    }

    function test_wrongOwnerSignatureIsRejected() public {
        Session memory session = defaultSession();
        ownerKey = uint256(keccak256("not the owner"));
        ERC4337.PackedUserOperation memory op =
            signEnable(userOp(smartAccount, callSetValue(1)), session);

        vm.expectPartialRevert(IEntryPoint.FailedOpWithRevert.selector);
        handleOp(op);
        assertFalse(
            smartSession.isPermissionEnabled(smartSession.getPermissionId(session), smartAccount)
        );
    }

    /// @dev A daily spend budget through Namera's policies, with the agent's time appended to the account's
    /// `execute` calldata: the account must ignore the trailing word, and the budget must hold.
    function test_namerasSpendPolicyRunsOnTheAccount() public {
        MockERC20 token = new MockERC20();
        token.mint(smartAccount, 1000);
        uint256 t = 20_000 days + 100;
        vm.warp(t);

        SpendPolicy.Limit[] memory limits = new SpendPolicy.Limit[](1);
        limits[0] = SpendPolicy.Limit(address(token), 100, 1 days, true);
        Session memory session = SessionBuilder.create(
                ISessionValidator(address(sessionValidator)),
                SessionBuilder.ecdsaConfig(sessionSigner),
                keccak256("spend")
            )
            .withAction(address(token), bytes4(0xa9059cbb), address(new AllowPolicy()), "")
            .withUserOpPolicy(address(new SpendPolicy()), abi.encode(limits));
        address recipient = makeAddr("recipient");

        bytes memory spend60 = PolicyCalls.withTime(
            PolicyCalls.single(address(token), 0, PolicyCalls.transfer(recipient, 60)), t
        );
        handleOp(signEnable(userOp(smartAccount, spend60), session));
        assertEq(token.balanceOf(recipient), 60);

        PermissionId permissionId = smartSession.getPermissionId(session);
        bytes memory spend50 = PolicyCalls.withTime(
            PolicyCalls.single(address(token), 0, PolicyCalls.transfer(recipient, 50)), t
        );
        ERC4337.PackedUserOperation memory over =
            signUse(userOp(smartAccount, spend50), permissionId);
        vm.expectPartialRevert(IEntryPoint.FailedOpWithRevert.selector);
        handleOp(over);
        assertEq(token.balanceOf(recipient), 60);
    }
}
