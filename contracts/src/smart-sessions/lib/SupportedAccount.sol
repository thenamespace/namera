// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

/// @notice The one account Namera's modules support: Kernel 3.3 (EntryPoint v0.7), deployed or through EIP-7702.
/// @dev Smart Sessions and SessionHook rely on Kernel 3.3's behaviour: its validator-bound hook through
/// `executeUserOp`, its `Kernel(bytes32 hash)` ERC-1271 wrapper, and which modules `isModuleInstalled` reports. They
/// refuse to install elsewhere, so no account they were never checked against can use them. The account's own
/// `accountId()` answers: a false answer only exposes that account.
library SupportedAccount {
    /// @dev Kernel 3.3's ERC-7579 `accountId()`.
    bytes32 internal constant KERNEL_V0_3_3 = keccak256("kernel.advanced.v0.3.3");

    error UnsupportedAccount(address account);

    /// @dev Reverts unless `account` reports Kernel 3.3's `accountId()`.
    // slither-disable-next-line low-level-calls
    function check(address account) internal view {
        (bool success, bytes memory result) =
            account.staticcall(abi.encodeWithSignature("accountId()"));
        if (
            !success || result.length < 64
                || keccak256(bytes(abi.decode(result, (string)))) != KERNEL_V0_3_3
        ) revert UnsupportedAccount(account);
    }
}
