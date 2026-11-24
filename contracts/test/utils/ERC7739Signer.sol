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

    /// @dev An app's typed data: `\x19\x01 ‖ appDomainSeparator ‖ contents` is the hash the app asks to check, and
    /// `contentsData` is the struct's EIP-712 `encodeData` (`contents == keccak256(contentsData)`).
    struct AppData {
        bytes32 appDomainSeparator;
        bytes32 contents;
        bytes contentsData;
        string contentsType;
        string contentsName;
    }

    function mail(bytes32 appDomainSeparator, address to) internal pure returns (AppData memory) {
        string memory contentsType = "Mail(address to)";
        return typedData(
            appDomainSeparator, contentsType, "Mail", abi.encode(keccak256(bytes(contentsType)), to)
        );
    }

    function typedData(
        bytes32 appDomainSeparator,
        string memory contentsType,
        string memory contentsName,
        bytes memory contentsData
    ) internal pure returns (AppData memory) {
        return AppData({
            appDomainSeparator: appDomainSeparator,
            contents: keccak256(contentsData),
            contentsData: contentsData,
            contentsType: contentsType,
            contentsName: contentsName
        });
    }

    function appHash(AppData memory app) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", app.appDomainSeparator, app.contents));
    }

    /// @dev The digest the session key signs: the app data wrapped in `TypedDataSign` for `account`'s domain, or
    /// for `("", "", chainid, account, 0)` when the account has no `eip712Domain()`.
    function nestedHash(AppData memory app, address account) internal view returns (bytes32) {
        bytes32 typedDataSignTypehash = keccak256(
            abi.encodePacked(
                "TypedDataSign(",
                app.contentsName,
                " contents,string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)",
                app.contentsType
            )
        );
        bytes32 structHash =
            keccak256(abi.encodePacked(typedDataSignTypehash, app.contents, domainFields(account)));
        return keccak256(abi.encodePacked(hex"1901", app.appDomainSeparator, structHash));
    }

    /// @dev `account`'s EIP-712 domain fields as `TypedDataSign` encodes them (strings hashed), or those of
    /// `("", "", chainid, account, 0)` when it has no `eip712Domain()`.
    function domainFields(address account) internal view returns (bytes memory) {
        try IERC5267(account).eip712Domain() returns (
            bytes1,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory
        ) {
            return abi.encode(
                keccak256(bytes(name)), keccak256(bytes(version)), chainId, verifyingContract, salt
            );
        } catch {
            return abi.encode(keccak256(""), keccak256(""), block.chainid, account, bytes32(0));
        }
    }

    /// @dev Signature for `SmartSession.isValidSignatureWithSender`: permission ID, the ECDSA session key
    /// signature (EIP-191), the typed data for ERC-1271 policies and the ERC-7739 appendix.
    function sign(
        AppData memory app,
        address account,
        PermissionId permissionId,
        uint256 sessionKey
    ) internal view returns (bytes memory) {
        return sign(app, account, permissionId, sessionKey, app.contentsData, "");
    }

    /// @dev `sign` with the given `contentsData` (empty to leave it out, or not the struct's preimage) and
    /// `policyData`.
    function sign(
        AppData memory app,
        address account,
        PermissionId permissionId,
        uint256 sessionKey,
        bytes memory contentsData,
        bytes memory policyData
    ) internal view returns (bytes memory) {
        return abi.encodePacked(
            permissionId,
            sessionKeySignature(app, account, sessionKey),
            contentsData,
            policyData,
            uint16(contentsData.length),
            uint16(policyData.length),
            appendix(app)
        );
    }

    /// @dev The ECDSA session key signature (EIP-191) of the nested hash.
    function sessionKeySignature(AppData memory app, address account, uint256 sessionKey)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = ECDSA.toEthSignedMessageHash(nestedHash(app, account));
        (uint8 v, bytes32 r, bytes32 s) = VM.sign(sessionKey, digest);
        return abi.encodePacked(r, s, v);
    }

    /// @dev The ERC-7739 appendix: app domain separator, contents, contents description and its length.
    function appendix(AppData memory app) internal pure returns (bytes memory) {
        return abi.encodePacked(
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
