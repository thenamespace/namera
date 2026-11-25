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
import {MockTarget} from "../utils/mocks/MockTarget.sol";

/// @notice SmartSession on a real Kernel 3.3 account (loaded from fixtures). `KernelTest` supplies how to deploy the
/// account with SmartSession installed, its nonce key layout and its owner ERC-1271 signature format; the session
/// flows below run with and without SessionHook (`KernelSessionHookTest`).
abstract contract RealAccountTestBase is SmartSessionTestBase {
    using SessionBuilder for Session;

    /// @dev Kernel's ECDSA validator, which holds the account's owner and takes the account's calls as configuration.
    address internal constant ENTRY_POINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address internal constant ECDSA_VALIDATOR = 0x845ADb2C711129d4f3966735eD98a9F09fC4cE57;

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

    /// @dev Regression (internal review, findings 1 and 7): the fallback action can't call the account's owner
    /// validator (replacing the owner) or the EntryPoint (moving the deposit out); both need an explicit action.
    function test_theFallbackCannotReachTheOwnersValidatorOrTheEntryPoint() public {
        Session memory session = defaultSession().withFallbackAction(address(new AllowPolicy()), "");
        session.salt = keccak256("fallback infrastructure");
        PermissionId permissionId = smartSession.getPermissionId(session);
        handleOp(signEnable(userOp(smartAccount, callSetValue(1)), session));

        address[2] memory targets = [ECDSA_VALIDATOR, address(entryPoint)];
        bytes[2] memory calls = [
            abi.encodeWithSignature("onUninstall(bytes)", ""),
            abi.encodeWithSignature("withdrawTo(address,uint256)", makeAddr("thief"), 1)
        ];
        for (uint256 i; i < targets.length; ++i) {
            ERC4337.PackedUserOperation memory op =
                signUse(userOp(smartAccount, executeSingle(targets[i], 0, calls[i])), permissionId);
            vm.expectPartialRevert(IEntryPoint.FailedOpWithRevert.selector);
            handleOp(op);
        }

        // Any other target still goes through the fallback (the session has no action for this one).
        MockTarget other = new MockTarget();
        handleOp(
            signUse(
                userOp(
                    smartAccount,
                    executeSingle(address(other), 0, abi.encodeCall(MockTarget.setValue, (2)))
                ),
                permissionId
            )
        );
        assertEq(other.value(), 2);
    }

    /// @dev Regression (rerun review, findings 1 to 3; 1-pass review, finding 1): the fallback can't call a module
    /// lifecycle or hook function on any contract (Kernel's permission signers and bound hooks aren't reported as
    /// installed), nor send calldata ending in the account's or the EntryPoint's (v0.7, Kernel 3.3's) address, which
    /// ERC-2771 contracts (the account's fallback handlers) read as the account or the EntryPoint calling.
    function test_theFallbackCannotConfigureModulesOrActAsTheAccount() public {
        Session memory session = defaultSession().withFallbackAction(address(new AllowPolicy()), "");
        session.salt = keccak256("fallback modules");
        PermissionId permissionId = smartSession.getPermissionId(session);
        handleOp(signEnable(userOp(smartAccount, callSetValue(1)), session));

        MockTarget other = new MockTarget();
        bytes memory setValue = abi.encodeCall(MockTarget.setValue, (3));
        bytes[6] memory calls = [
            abi.encodeWithSignature("onInstall(bytes)", ""),
            abi.encodeWithSignature("onUninstall(bytes)", ""),
            abi.encodeWithSignature("preCheck(address,uint256,bytes)", address(0), 0, ""),
            abi.encodeWithSignature("postCheck(bytes)", ""),
            abi.encodePacked(setValue, smartAccount),
            abi.encodePacked(setValue, ENTRY_POINT_V07)
        ];
        for (uint256 i; i < calls.length; ++i) {
            ERC4337.PackedUserOperation memory op = signUse(
                userOp(smartAccount, executeSingle(address(other), 0, calls[i])), permissionId
            );
            vm.expectPartialRevert(IEntryPoint.FailedOpWithRevert.selector);
            handleOp(op);
        }
        assertEq(other.value(), 0);

        // Calldata ending in another address still goes through.
        handleOp(
            signUse(
                userOp(
                    smartAccount,
                    executeSingle(address(other), 0, abi.encodePacked(setValue, address(other)))
                ),
                permissionId
            )
        );
        assertEq(other.value(), 3);
    }
}
