// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Vm} from "forge-std/Vm.sol";
import {ERC4337} from "solady/accounts/ERC4337.sol";

/// @notice The parts of the EntryPoint v0.7 interface the tests use.
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

/// @notice Installs the canonical EntryPoint v0.7 (and its SenderCreator) from deployed bytecode.
library EntryPointFixture {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    IEntryPoint internal constant ENTRY_POINT =
        IEntryPoint(0x0000000071727De22E5E9d8BAf0edAc6f37da032);
    address internal constant SENDER_CREATOR = 0xEFC2c1444eBCC4Db75e7613d20C6a62fF67A167C;

    function install() internal {
        VM.etch(address(ENTRY_POINT), readCode("test/fixtures/entrypoint-v0.7.hex"));
        VM.etch(SENDER_CREATOR, readCode("test/fixtures/sender-creator-v0.7.hex"));
        VM.label(address(ENTRY_POINT), "EntryPoint");
    }

    function readCode(string memory path) internal view returns (bytes memory) {
        return VM.parseBytes(VM.trim(VM.readFile(path)));
    }
}
