// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {SmartSessionTestBase} from "../utils/SmartSessionTestBase.sol";
import {RealAccountTestBase} from "./RealAccountTestBase.sol";
import {SessionHookFlows} from "./SessionHookFlows.sol";

interface INexusModules {
    function uninstallModule(uint256 moduleType, address module, bytes calldata deInitData)
        external
        payable;
}

interface INexusFactory {
    function createAccount(bytes calldata initData, bytes32 salt) external payable returns (address);
}

interface INexusBootstrap {
    struct BootstrapConfig {
        address module;
        bytes data;
    }

    struct BootstrapPreValidationHookConfig {
        uint256 hookType;
        address module;
        bytes data;
    }

    function initNexusWithDefaultValidatorAndOtherModulesNoRegistry(
        bytes calldata defaultValidatorInitData,
        BootstrapConfig[] calldata validators,
        BootstrapConfig[] calldata executors,
        BootstrapConfig calldata hook,
        BootstrapConfig[] calldata fallbacks,
        BootstrapPreValidationHookConfig[] calldata preValidationHooks
    ) external;
}

/// @notice Nexus 1.3.3 with the default K1 validator (owner) and SmartSession as an extra validator.
contract NexusTest is RealAccountTestBase {
    address internal constant FACTORY = 0x0000b1C08f1418dA76B5E99c1Bf5718486cf8c53;
    address internal constant BOOTSTRAP = 0x0000B1c0A80cb7DD166a15e7390b8A4Ced4500C6;

    function deployAccount() internal virtual override returns (address) {
        INexusBootstrap.BootstrapConfig[] memory validators =
            new INexusBootstrap.BootstrapConfig[](1);
        validators[0] = INexusBootstrap.BootstrapConfig(address(smartSession), "");
        bytes memory bootstrapCall = abi.encodeCall(
            INexusBootstrap.initNexusWithDefaultValidatorAndOtherModulesNoRegistry,
            (
                abi.encodePacked(owner),
                validators,
                new INexusBootstrap.BootstrapConfig[](0),
                withSessionHook()
                    ? INexusBootstrap.BootstrapConfig(
                        address(sessionHook), abi.encode(uint8(2), address(smartSession))
                    )
                    : INexusBootstrap.BootstrapConfig(address(0), ""),
                new INexusBootstrap.BootstrapConfig[](0),
                new INexusBootstrap.BootstrapPreValidationHookConfig[](0)
            )
        );
        return
            INexusFactory(FACTORY)
                .createAccount(abi.encode(BOOTSTRAP, bootstrapCall), keccak256(""));
    }

    /// @dev Nexus nonce key: 3-byte key ‖ mode (0) ‖ validator.
    function sessionNonceKey() internal view virtual override returns (uint192) {
        return uint192(bytes24(abi.encodePacked(bytes3(0), bytes1(0), address(smartSession))));
    }

    /// @dev Nexus ERC-1271 with the default validator: 20 zero bytes ‖ signature over the ERC-7739
    /// `PersonalSign` wrapping of the hash in the account's domain.
    function ownerSignature(address account, bytes32 digest)
        internal
        view
        virtual
        override
        returns (bytes memory)
    {
        bytes32 personalSign = keccak256(
            abi.encodePacked(
                hex"1901",
                accountDomainSeparator(account),
                keccak256(abi.encode(keccak256("PersonalSign(bytes prefixed)"), digest))
            )
        );
        return abi.encodePacked(address(0), signRaw(ownerKey, personalSign));
    }
}

/// @notice Nexus with SessionHook as the account's hook: execution policies on top of every session flow.
contract NexusSessionHookTest is NexusTest, SessionHookFlows {
    function deployAccount() internal override(NexusTest, RealAccountTestBase) returns (address) {
        return NexusTest.deployAccount();
    }

    function sessionNonceKey()
        internal
        view
        override(NexusTest, SmartSessionTestBase)
        returns (uint192)
    {
        return NexusTest.sessionNonceKey();
    }

    function ownerSignature(address account, bytes32 digest)
        internal
        view
        override(NexusTest, SmartSessionTestBase)
        returns (bytes memory)
    {
        return NexusTest.ownerSignature(account, digest);
    }

    function setUp() public override(RealAccountTestBase, SessionHookFlows) {
        SessionHookFlows.setUp();
    }

    function withSessionHook() internal pure override returns (bool) {
        return true;
    }

    function unbindSessionHook() internal override {
        vm.prank(smartAccount);
        INexusModules(smartAccount).uninstallModule(4, address(sessionHook), "");
    }
}
