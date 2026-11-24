// SPDX-License-Identifier: LGPL-3.0-only
// Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera; see NOTICE.md.
pragma solidity 0.8.38;

/// @notice Stateless signature validator for session keys (ERC-7579 module type 7).
/// @dev SmartSession stores each session's validator config and passes it as `data`, so one validator serves
/// many sessions. A validator may aggregate several signatures packed into `signature`.
interface ISessionValidator {
    /// @notice Whether the validator is of ERC-7579 module type `moduleTypeId` (7 for a session validator).
    function isModuleType(uint256 moduleTypeId) external view returns (bool);

    /// @notice Whether `signature` is the session key's signature of `hash`, under the session's config `data`.
    /// @param hash The user operation hash, or the nested ERC-7739 hash for ERC-1271 requests.
    function validateSignatureWithData(bytes32 hash, bytes calldata signature, bytes calldata data)
        external
        view
        returns (bool validSig);
}
