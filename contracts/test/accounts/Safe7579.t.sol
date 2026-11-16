// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {RealAccountTestBase} from "./RealAccountTestBase.sol";

interface ISafeProxyFactory {
    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce)
        external
        returns (address proxy);
}

interface ISafe {
    function setup(
        address[] calldata owners,
        uint256 threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;
}

interface ISafe7579Launchpad {
    struct ModuleInit {
        address module;
        bytes initData;
        uint256 moduleType;
    }

    function addSafe7579(
        address safe7579,
        ModuleInit[] calldata validators,
        address[] calldata attesters,
        uint8 threshold
    ) external;
}

/// @notice Safe 1.4.1 with the Safe7579 v2 adapter: the owner is an OwnableValidator, SmartSession a second
/// validator; no registry attesters.
contract Safe7579Test is RealAccountTestBase {
    address internal constant SAFE_SINGLETON_L2 = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address internal constant PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address internal constant ADAPTER = 0x7579f2AD53b01c3D8779Fe17928e0D48885B0003;
    address internal constant LAUNCHPAD = 0x75798463024Bda64D83c94A64Bc7D7eaB41300eF;
    address internal constant OWNABLE_VALIDATOR = 0x000000000013fdB5234E4E3162a810F54d9f7E98;

    function deployAccount() internal override returns (address) {
        address[] memory owners = new address[](1);
        owners[0] = owner;

        ISafe7579Launchpad.ModuleInit[] memory validators = new ISafe7579Launchpad.ModuleInit[](2);
        validators[0] = ISafe7579Launchpad.ModuleInit({
            module: OWNABLE_VALIDATOR, initData: abi.encode(uint256(1), owners), moduleType: 1
        });
        validators[1] = ISafe7579Launchpad.ModuleInit({
            module: address(smartSession), initData: "", moduleType: 1
        });
        bytes memory addSafe7579 = abi.encodeCall(
            ISafe7579Launchpad.addSafe7579, (ADAPTER, validators, new address[](0), 0)
        );
        bytes memory initializer = abi.encodeCall(
            ISafe.setup,
            (owners, 1, LAUNCHPAD, addSafe7579, ADAPTER, address(0), 0, payable(address(0)))
        );
        return
            ISafeProxyFactory(PROXY_FACTORY).createProxyWithNonce(SAFE_SINGLETON_L2, initializer, 0);
    }

    /// @dev Safe7579 nonce key: validator address ‖ 4-byte key.
    function sessionNonceKey() internal view override returns (uint192) {
        return uint192(uint160(address(smartSession))) << 32;
    }

    /// @dev Safe7579 ERC-1271: validator address ‖ signature; OwnableValidator checks the raw hash.
    function ownerSignature(address, bytes32 digest) internal view override returns (bytes memory) {
        return abi.encodePacked(OWNABLE_VALIDATOR, signRaw(ownerKey, digest));
    }
}
