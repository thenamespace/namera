// SPDX-License-Identifier: AGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
// Nested EIP-712 (ERC-7739) assembly derived from Solady's ERC1271 (MIT).
pragma solidity 0.8.38;

import {ISmartSession} from "../ISmartSession.sol";
import {EIP712} from "solady/utils/EIP712.sol";

/// @notice ERC-7739 (nested EIP-712) unwrapping for session-key ERC-1271 signatures.
/// @dev A session key signs the app's typed data wrapped in `TypedDataSign`, bound to the account's EIP-712
/// domain, so one session key cannot replay a signature across accounts and wallets still show the app's data:
///
///     keccak256(\x19\x01 ‖ APP_DOMAIN_SEPARATOR ‖ hashStruct(TypedDataSign({
///         contents: hashStruct(appStruct),
///         name, version, chainId, verifyingContract, salt   // the account's eip712Domain()
///     })))
///
/// The signature is `sessionKeySignature ‖ APP_DOMAIN_SEPARATOR ‖ contents ‖ contentsDescription ‖
/// uint16(contentsDescription.length)`. `keccak256(\x19\x01 ‖ APP_DOMAIN_SEPARATOR ‖ contents)` must equal the
/// requested hash. Only the `TypedDataSign` workflow is supported (no `PersonalSign`).
abstract contract SmartSessionERC7739 is ISmartSession {
    /// @dev Validates the unwrapped signature for the final nested hash; implemented by SmartSession.
    /// `contentsDescription` is a slice of the signature right after the app struct's hash (`contents`), which
    /// `_contents` reads.
    function _erc1271IsValidSignatureNowCalldata(
        address sender,
        bytes32 hash,
        bytes calldata signature,
        bytes32 appDomainSeparator,
        bytes calldata contentsDescription
    ) internal view virtual returns (bool);

    /// @dev The app struct's hash: the word before `contentsDescription` in the signature (no stack room to pass
    /// it alongside the slice).
    function _contents(bytes calldata contentsDescription)
        internal
        pure
        returns (bytes32 contents)
    {
        assembly ("memory-safe") {
            contents := calldataload(sub(contentsDescription.offset, 0x20))
        }
    }

    // Reviewed false positives: the `0x6492...` marker is built as `mul(0x6492, div(...))`, and `result` is
    // reassigned on purpose when the wrapper is present.
    // slither-disable-start divide-before-multiply,write-after-write
    // forge-lint: disable-start(divide-before-multiply)
    /// @dev Removes an ERC-6492 wrapper (counterfactual accounts) if present.
    function _erc1271UnwrapSignature(bytes calldata signature)
        internal
        view
        virtual
        returns (bytes calldata result)
    {
        result = signature;
        assembly ("memory-safe") {
            if eq(
                calldataload(add(result.offset, sub(result.length, 0x20))),
                mul(0x6492, div(not(mload(0x60)), 0xffff)) // `0x6492...6492`.
            ) {
                let o := add(result.offset, calldataload(add(result.offset, 0x40)))
                result.length := calldataload(o)
                result.offset := add(o, 0x20)
            }
        }
    }

    // forge-lint: disable-end(divide-before-multiply)
    // slither-disable-end divide-before-multiply,write-after-write

    // Reviewed false positives: shifting constant character bitmaps by a byte value is intended
    // (`incorrect-shift`, `too-many-digits`), `contents` is a calldata slice and `appDomainSeparator` is set in
    // assembly, and the unused `eip712Domain()` fields are not needed.
    // slither-disable-start incorrect-shift,write-after-write,unused-return,too-many-digits
    // forge-lint: disable-start(incorrect-shift,uninitialized-local,unused-return)
    /// @dev Rebuilds the nested hash from `signature` and the caller's (account's) EIP-712 domain, then forwards
    /// to `_erc1271IsValidSignatureNowCalldata`. Returns false if the signature is not bound to `hash`.
    function _erc1271IsValidSignatureViaNestedEIP712(
        address sender,
        bytes32 hash,
        bytes calldata signature
    ) internal view virtual returns (bool result) {
        bytes calldata contents = signature;
        bytes32 appDomainSeparator;
        bool unbound;
        uint256 t = uint256(uint160(address(this)));
        // The scope lets the compiler pop the domain fields again (stack depth).
        if (t != uint256(0)) {
            (
                ,
                string memory name,
                string memory version,
                uint256 chainId,
                address verifyingContract,
                bytes32 salt,
            ) = EIP712(msg.sender).eip712Domain();
            assembly ("memory-safe") {
                t := mload(0x40)
                // Leave two words for the TypedDataSign typehash and `contents`.
                mstore(add(t, 0x40), keccak256(add(name, 0x20), mload(name)))
                mstore(add(t, 0x60), keccak256(add(version, 0x20), mload(version)))
                mstore(add(t, 0x80), chainId)
                mstore(add(t, 0xa0), shr(96, shl(96, verifyingContract)))
                mstore(add(t, 0xc0), salt)
                mstore(0x40, add(t, 0xe0))
            }
        }
        assembly ("memory-safe") {
            let m := mload(0x40)
            // `c`: length of `contentsDescription`, from the last two bytes of the signature.
            let c := shr(240, calldataload(add(signature.offset, sub(signature.length, 2))))
            for {} 1 {} {
                let l := add(0x42, c) // appended data: 32 + 32 + c + 2 bytes
                let o := add(signature.offset, sub(signature.length, l))
                mstore(0x00, 0x1901)
                calldatacopy(0x20, o, 0x40) // APP_DOMAIN_SEPARATOR, contents
                // Namera fix: the signed `\x19\x01 ‖ APP_DOMAIN_SEPARATOR ‖ contents` must be the requested
                // `hash`, and the appended data must fit in the signature and be non-empty (as in Solady).
                // Upstream rebuilt `hash` from the signature alone, so one signature validated for any hash.
                if or(xor(keccak256(0x1e, 0x42), hash), or(lt(signature.length, l), iszero(c))) {
                    unbound := 1
                    break
                }
                // TypedDataSign type: `TypedDataSign({ContentsName} contents,string name,...){ContentsType}`.
                mstore(m, "TypedDataSign(")
                let p := add(m, 0x0e)
                calldatacopy(p, add(o, 0x40), c) // `contentsName`, assuming implicit mode
                contents.offset := add(o, 0x40)
                contents.length := c
                mstore(add(p, c), 40) // '('
                // Explicit mode (description does not end with ')'): the name is the trailing part.
                if iszero(eq(byte(0, mload(sub(add(p, c), 1))), 41)) {
                    let e := 0
                    for { let q := sub(add(p, c), 1) } 1 {} {
                        e := add(e, 1)
                        if iszero(gt(lt(e, c), eq(byte(0, mload(sub(q, e))), 41))) {
                            break
                        }
                    }
                    c := sub(c, e) // truncate the description to `contentsType`
                    calldatacopy(p, add(add(o, 0x40), c), e)
                    mstore8(add(p, e), 40)
                }
                // `d & 1 == 1` marks an invalid `contentsName`: must start with [a-z(] and contain none of ", )\x00".
                let d := shr(byte(0, mload(p)), 0x7fffffe000000000000010000000000)
                for {} iszero(eq(byte(0, mload(p)), 40)) { p := add(p, 1) } {
                    d := or(shr(byte(0, mload(p)), 0x120100000001), d)
                }
                mstore(p, " contents,string name,string")
                mstore(add(p, 0x1c), " version,uint256 chainId,address")
                mstore(add(p, 0x3c), " verifyingContract,bytes32 salt)")
                p := add(p, 0x5c)
                calldatacopy(p, add(o, 0x40), c) // `contentsType`
                calldatacopy(t, o, 0x40) // `contents` lands at t + 0x20
                mstore(t, keccak256(m, sub(add(p, c), m))) // TypedDataSign typehash
                appDomainSeparator := mload(0x20)
                mstore(0x40, keccak256(t, 0xe0)) // hashStruct(TypedDataSign)
                // Final hash; corrupted (one extra byte hashed) if `contentsName` is invalid.
                hash := keccak256(0x1e, add(0x42, and(1, d)))
                signature.length := sub(signature.length, l)
                break
            }
            mstore(0x40, m)
        }
        if (unbound) return false;
        result = _erc1271IsValidSignatureNowCalldata(
            sender, hash, signature, appDomainSeparator, contents
        );
    }
    // forge-lint: disable-end(incorrect-shift,uninitialized-local,unused-return)
    // slither-disable-end incorrect-shift,write-after-write,unused-return,too-many-digits
}
