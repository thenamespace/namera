// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC165} from "../interfaces/IERC165.sol";

/// @notice ERC-165 detection with the same semantics as OpenZeppelin's `ERC165Checker.supportsInterface`:
/// the target must report support for ERC-165 itself, report no support for `0xffffffff`, and report
/// support for `interfaceId`. Each query is a staticcall capped at 30,000 gas.
library ERC165Checker {
    bytes4 private constant INTERFACE_ID_INVALID = 0xffffffff;
    uint256 private constant QUERY_GAS = 30_000;

    function supportsInterface(address account, bytes4 interfaceId) internal view returns (bool) {
        return supportsERC165(account) && query(account, interfaceId);
    }

    function supportsERC165(address account) internal view returns (bool) {
        return query(account, type(IERC165).interfaceId) && !query(account, INTERFACE_ID_INVALID);
    }

    function query(address account, bytes4 interfaceId) private view returns (bool supported) {
        bytes memory encodedCall = abi.encodeCall(IERC165.supportsInterface, (interfaceId));
        assembly ("memory-safe") {
            let success :=
                staticcall(
                    QUERY_GAS,
                    account,
                    add(encodedCall, 0x20),
                    mload(encodedCall),
                    0x00,
                    0x20
                )
            supported := and(success, and(gt(returndatasize(), 0x1f), gt(mload(0x00), 0)))
        }
    }
}
