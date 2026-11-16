// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {RealAccountTestBase} from "./RealAccountTestBase.sol";

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
}

/// @notice Kernel 3.3 with the ECDSA validator as root; SmartSession installed for `execute`.
contract KernelTest is RealAccountTestBase {
    address internal constant FACTORY = 0x2577507b78c2008Ff367261CB6285d44ba5eF2E9;
    address internal constant ECDSA_VALIDATOR = 0x845ADb2C711129d4f3966735eD98a9F09fC4cE57;
    bytes4 internal constant EXECUTE = 0xe9ae5c53;

    function deployAccount() internal override returns (address) {
        // Kernel validator install data: hook (1 = none) ‖ abi.encode(validatorData, hookData, selectorData).
        bytes memory installData = abi.encodePacked(
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

    /// @dev Kernel nonce key: mode (0) ‖ validation type (1 = validator) ‖ validator ‖ 2-byte key.
    function sessionNonceKey() internal view override returns (uint192) {
        return uint192(
            bytes24(abi.encodePacked(bytes1(0), bytes1(0x01), address(smartSession), bytes2(0)))
        );
    }

    /// @dev Kernel ERC-1271: `0x01 ‖ validator ‖ signature` over the hash wrapped as EIP-712 `Kernel(bytes32 hash)`
    /// in the account's domain.
    function ownerSignature(address account, bytes32 digest)
        internal
        view
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
