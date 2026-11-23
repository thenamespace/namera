// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {PermissionId, Session} from "src/smart-sessions/DataTypes.sol";

import {IEntryPoint} from "../utils/EntryPoint.sol";
import {SmartSessionTestBase} from "../utils/SmartSessionTestBase.sol";
import {MockExecutionPolicy} from "../utils/mocks/MockExecutionPolicy.sol";
import {RealAccountTestBase} from "./RealAccountTestBase.sol";
import {SessionHookFlows} from "./SessionHookFlows.sol";

interface IKernelFactory {
    function createAccount(bytes calldata data, bytes32 salt) external payable returns (address);
}

interface IKernel {
    function initialize(
        bytes21 rootValidator,
        address hook,
        bytes calldata validatorData,
        bytes calldata hookData,
        bytes[] calldata initConfig
    ) external;

    function installModule(uint256 moduleType, address module, bytes calldata initData)
        external
        payable;

    function uninstallModule(uint256 moduleType, address module, bytes calldata deInitData)
        external
        payable;
}

/// @notice Kernel 3.3 with the ECDSA validator as root; SmartSession installed for `execute`.
contract KernelTest is RealAccountTestBase {
    address internal constant FACTORY = 0x2577507b78c2008Ff367261CB6285d44ba5eF2E9;
    address internal constant ECDSA_VALIDATOR = 0x845ADb2C711129d4f3966735eD98a9F09fC4cE57;
    bytes4 internal constant EXECUTE = 0xe9ae5c53;

    bytes4 internal constant EXECUTE_USER_OP = 0x8dd7712f;

    function deployAccount() internal virtual override returns (address) {
        // Kernel validator install data: hook (1 = none) ‖ abi.encode(validatorData, hookData, selectorData). With
        // SessionHook, `hookData` is flag 0xff (always run the hook's onInstall) ‖ its install data.
        bytes memory installData = withSessionHook()
            ? abi.encodePacked(
                address(sessionHook),
                abi.encode(
                    bytes(""),
                    abi.encodePacked(bytes1(0xff), abi.encode(uint8(1), address(smartSession))),
                    abi.encodePacked(EXECUTE)
                )
            )
            : abi.encodePacked(
                address(1), abi.encode(bytes(""), bytes(""), abi.encodePacked(EXECUTE))
            );
        bytes[] memory initConfig = new bytes[](1);
        initConfig[0] = abi.encodeCall(
            IKernel.installModule, (MODULE_TYPE_VALIDATOR, address(smartSession), installData)
        );
        bytes memory initData = abi.encodeCall(
            IKernel.initialize,
            (
                bytes21(abi.encodePacked(uint8(1), ECDSA_VALIDATOR)),
                address(0),
                abi.encodePacked(owner),
                "",
                initConfig
            )
        );
        return IKernelFactory(FACTORY).createAccount(initData, bytes32(0));
    }

    /// @dev Kernel runs a validator's hook only through `executeUserOp`, which executes the wrapped `execute`.
    function wrapCallData(bytes memory callData)
        internal
        view
        virtual
        override
        returns (bytes memory)
    {
        return withSessionHook() ? abi.encodePacked(EXECUTE_USER_OP, callData) : callData;
    }

    /// @dev Kernel nonce key: mode (0) ‖ validation type (1 = validator) ‖ validator ‖ 2-byte key.
    function sessionNonceKey() internal view virtual override returns (uint192) {
        return uint192(
            bytes24(abi.encodePacked(bytes1(0), bytes1(0x01), address(smartSession), bytes2(0)))
        );
    }

    /// @dev Kernel ERC-1271: `0x01 ‖ validator ‖ signature` over the hash wrapped as EIP-712 `Kernel(bytes32 hash)`
    /// in the account's domain.
    function ownerSignature(address account, bytes32 digest)
        internal
        view
        virtual
        override
        returns (bytes memory)
    {
        bytes32 wrapped = keccak256(
            abi.encodePacked(
                hex"1901",
                accountDomainSeparator(account),
                keccak256(abi.encode(keccak256("Kernel(bytes32 hash)"), digest))
            )
        );
        return abi.encodePacked(uint8(1), ECDSA_VALIDATOR, signRaw(ownerKey, wrapped));
    }
}

/// @notice Kernel with SessionHook bound to SmartSession's validation: execution policies, and every session flow
/// wrapped in `executeUserOp`.
contract KernelSessionHookTest is KernelTest, SessionHookFlows {
    function deployAccount() internal override(KernelTest, RealAccountTestBase) returns (address) {
        return KernelTest.deployAccount();
    }

    function sessionNonceKey()
        internal
        view
        override(KernelTest, SmartSessionTestBase)
        returns (uint192)
    {
        return KernelTest.sessionNonceKey();
    }

    function ownerSignature(address account, bytes32 digest)
        internal
        view
        override(KernelTest, SmartSessionTestBase)
        returns (bytes memory)
    {
        return KernelTest.ownerSignature(account, digest);
    }

    function wrapCallData(bytes memory callData)
        internal
        view
        override(KernelTest, SmartSessionTestBase)
        returns (bytes memory)
    {
        return KernelTest.wrapCallData(callData);
    }

    function setUp() public override(RealAccountTestBase, SessionHookFlows) {
        SessionHookFlows.setUp();
    }

    function withSessionHook() internal pure override returns (bool) {
        return true;
    }

    function unbindSessionHook() internal override {
        vm.prank(smartAccount);
        IKernel(smartAccount).uninstallModule(4, address(sessionHook), "");
    }

    /// @dev Rebinding SmartSession to another hook never calls SessionHook's `onUninstall`; with no sessions it
    /// succeeds, and sessions enabled afterwards must fail validation, not run without their execution policies.
    function test_hook_rebindingSmartSessionWithoutTheHookFailsClosed() public {
        vm.prank(smartAccount);
        IKernel(smartAccount)
            .installModule(
                MODULE_TYPE_VALIDATOR,
                address(smartSession),
                abi.encodePacked(
                    address(1), abi.encode(bytes(""), bytes(""), abi.encodePacked(EXECUTE))
                )
            );

        Session memory session = hookedSession("rebound", MockExecutionPolicy.Mode.Pass);
        PermissionId permissionId = smartSession.getPermissionId(session);
        ERC4337.PackedUserOperation memory op = signEnable(
            userOp(
                smartAccount,
                abi.encodePacked(
                    callSetValue(7), sessionHook.tag(PermissionId.unwrap(permissionId))
                )
            ),
            session
        );
        vm.expectPartialRevert(IEntryPoint.FailedOpWithRevert.selector);
        handleOp(op);
        assertEq(target.value(), 0);
    }
}
