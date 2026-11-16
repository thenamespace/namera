// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Vm} from "forge-std/Vm.sol";
import {ECDSA} from "solady/utils/ECDSA.sol";

import {PermissionId} from "src/smart-sessions/DataTypes.sol";

interface IERC5267 {
    function eip712Domain()
        external
        view
        returns (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        );
}

/// @notice Builds ERC-7739 (nested EIP-712, TypedDataSign) session-key signatures.
library ERC7739Signer {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @dev An app's typed data: `\x19\x01 ‖ appDomainSeparator ‖ contents` is the hash the app asks to check.
    struct AppData {
        bytes32 appDomainSeparator;
        bytes32 contents;
        string contentsType;
        string contentsName;
    }

    function mail(bytes32 appDomainSeparator, address to) internal pure returns (AppData memory) {
        string memory contentsType = "Mail(address to)";
        return AppData({
            appDomainSeparator: appDomainSeparator,
            contents: keccak256(abi.encode(keccak256(bytes(contentsType)), to)),
            contentsType: contentsType,
            contentsName: "Mail"
        });
    }

    function appHash(AppData memory app) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", app.appDomainSeparator, app.contents));
    }

    /// @dev The digest the session key signs: the app data wrapped in `TypedDataSign` for `account`'s domain.
    function nestedHash(AppData memory app, address account) internal view returns (bytes32) {
        (
            ,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
        ) = IERC5267(account).eip712Domain();
        bytes32 typedDataSignTypehash = keccak256(
            abi.encodePacked(
                "TypedDataSign(",
                app.contentsName,
                " contents,string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)",
                app.contentsType
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                typedDataSignTypehash,
                app.contents,
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract,
                salt
            )
        );
        return keccak256(abi.encodePacked(hex"1901", app.appDomainSeparator, structHash));
    }

    /// @dev Signature for `SmartSession.isValidSignatureWithSender`: permission ID, the ECDSA session key
    /// signature (EIP-191) and the ERC-7739 appendix.
    function sign(
        AppData memory app,
        address account,
        PermissionId permissionId,
        uint256 sessionKey
    ) internal view returns (bytes memory) {
        bytes32 digest = ECDSA.toEthSignedMessageHash(nestedHash(app, account));
        (uint8 v, bytes32 r, bytes32 s) = VM.sign(sessionKey, digest);
        return abi.encodePacked(
            permissionId,
            r,
            s,
            v,
            app.appDomainSeparator,
            app.contents,
            app.contentsType,
            uint16(bytes(app.contentsType).length)
        );
    }

    /// @dev ERC-6492 wrapper for counterfactual accounts.
    function wrap6492(bytes memory signature) internal pure returns (bytes memory) {
        bytes32 magic = 0x6492649264926492649264926492649264926492649264926492649264926492;
        return abi.encodePacked(abi.encode(address(0), bytes(""), signature), magic);
    }
}
