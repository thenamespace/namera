// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";
import {LibERC7579} from "solady/accounts/LibERC7579.sol";
import {ECDSA} from "solady/utils/ECDSA.sol";
import {EIP712} from "solady/utils/EIP712.sol";

import {EntryPointFixture} from "../EntryPoint.sol";

interface IValidatorModule {
    function onInstall(bytes calldata data) external;
    function onUninstall(bytes calldata data) external;
    function validateUserOp(ERC4337.PackedUserOperation calldata userOp, bytes32 userOpHash)
        external
        returns (uint256);
    function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata signature)
        external
        view
        returns (bytes4);
}

/// @notice Minimal ERC-7579 account for module tests.
/// @dev Validator selection follows the common convention: the validator address is the top 20 bytes of the
/// 24-byte nonce key; key 0 means the owner (ECDSA over the EIP-191 user op hash). ERC-1271 signatures are either
/// a 65-byte owner signature over the raw hash or `validator ‖ signature`, forwarded to the validator.
contract MockAccount is EIP712 {
    uint256 internal constant MODULE_TYPE_VALIDATOR = 1;

    address public immutable owner;
    mapping(address validator => bool) public isValidatorInstalled;

    error Unauthorized();
    error ValidatorNotInstalled(address validator);
    error UnsupportedCallType(bytes1 callType);

    constructor(address owner_) {
        owner = owner_;
    }

    receive() external payable {}

    modifier onlyEntryPointOrSelf() {
        if (msg.sender != address(EntryPointFixture.ENTRY_POINT) && msg.sender != address(this)) {
            revert Unauthorized();
        }
        _;
    }

    function validateUserOp(
        ERC4337.PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external onlyEntryPointOrSelf returns (uint256 validationData) {
        address validator = address(uint160(userOp.nonce >> 96));
        if (validator == address(0)) {
            bytes32 digest = ECDSA.toEthSignedMessageHash(userOpHash);
            validationData = ECDSA.recoverCalldata(digest, userOp.signature) == owner ? 0 : 1;
        } else {
            if (!isValidatorInstalled[validator]) revert ValidatorNotInstalled(validator);
            validationData = IValidatorModule(validator).validateUserOp(userOp, userOpHash);
        }
        if (missingAccountFunds != 0) {
            (bool paid,) = msg.sender.call{value: missingAccountFunds}("");
            paid;
        }
    }

    function execute(bytes32 mode, bytes calldata executionData)
        external
        payable
        onlyEntryPointOrSelf
    {
        bytes1 callType = LibERC7579.getCallType(mode);
        if (callType == LibERC7579.CALLTYPE_SINGLE) {
            (address target, uint256 value, bytes calldata data) =
                LibERC7579.decodeSingle(executionData);
            _call(target, value, data);
        } else if (callType == LibERC7579.CALLTYPE_BATCH) {
            bytes32[] calldata pointers = LibERC7579.decodeBatch(executionData);
            for (uint256 i; i < pointers.length; ++i) {
                (address target, uint256 value, bytes calldata data) =
                    LibERC7579.getExecution(pointers, i);
                _call(target, value, data);
            }
        } else {
            revert UnsupportedCallType(callType);
        }
    }

    function installModule(uint256 moduleTypeId, address module, bytes calldata initData)
        external
        onlyEntryPointOrSelf
    {
        if (moduleTypeId == MODULE_TYPE_VALIDATOR) isValidatorInstalled[module] = true;
        IValidatorModule(module).onInstall(initData);
    }

    function uninstallModule(uint256 moduleTypeId, address module, bytes calldata deInitData)
        external
        onlyEntryPointOrSelf
    {
        if (moduleTypeId == MODULE_TYPE_VALIDATOR) isValidatorInstalled[module] = false;
        IValidatorModule(module).onUninstall(deInitData);
    }

    function isValidSignature(bytes32 hash, bytes calldata signature)
        external
        view
        returns (bytes4)
    {
        if (signature.length == 65) {
            return ECDSA.recoverCalldata(hash, signature) == owner
                ? bytes4(0x1626ba7e)
                : bytes4(0xffffffff);
        }
        address validator = address(bytes20(signature[:20]));
        if (!isValidatorInstalled[validator]) return 0xffffffff;
        return
            IValidatorModule(validator).isValidSignatureWithSender(msg.sender, hash, signature[20:]);
    }

    function _call(address target, uint256 value, bytes calldata data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly ("memory-safe") {
                revert(add(result, 0x20), mload(result))
            }
        }
    }

    function _domainNameAndVersion()
        internal
        pure
        override
        returns (string memory name, string memory version)
    {
        return ("MockAccount", "1");
    }
}
