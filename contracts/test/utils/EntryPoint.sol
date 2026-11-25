// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {Vm} from "forge-std/Vm.sol";
import {ERC4337} from "solady/accounts/ERC4337.sol";

/// @notice The parts of the EntryPoint v0.7 interface the tests use, on Solady's (ABI-identical)
/// `PackedUserOperation`.
interface IEntryPoint {
    error FailedOp(uint256 opIndex, string reason);
    error FailedOpWithRevert(uint256 opIndex, string reason, bytes inner);

    function handleOps(ERC4337.PackedUserOperation[] calldata ops, address payable beneficiary)
        external;

    function getUserOpHash(ERC4337.PackedUserOperation calldata userOp)
        external
        view
        returns (bytes32);

    function getNonce(address sender, uint192 key) external view returns (uint256);

    function depositTo(address account) external payable;
}

/// @notice Deploys EntryPoint v0.7 (eth-infinitism/account-abstraction v0.7.0) at its canonical address.
library EntryPointFixture {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    IEntryPoint internal constant ENTRY_POINT =
        IEntryPoint(0x0000000071727De22E5E9d8BAf0edAc6f37da032);
    address internal constant SENDER_CREATOR = 0xEFC2c1444eBCC4Db75e7613d20C6a62fF67A167C;

    function install() internal {
        address entryPoint = address(ENTRY_POINT);
        // Run the constructor at the canonical address. With nonce 1, the SenderCreator it creates lands at
        // its canonical address too.
        VM.etch(entryPoint, type(EntryPoint).creationCode);
        VM.setNonce(entryPoint, 1);
        (bool success, bytes memory runtimeCode) = entryPoint.call("");
        require(success, "EntryPoint constructor failed");
        VM.etch(entryPoint, runtimeCode);
        VM.label(entryPoint, "EntryPoint");
        VM.label(SENDER_CREATOR, "SenderCreator");
    }
}
