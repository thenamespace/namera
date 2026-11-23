// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {P256} from "@openzeppelin/contracts/utils/cryptography/P256.sol";

/// @notice The RIP-7212 / EIP-7951 precompile for tests, which run on an EVM without it: `h ‖ r ‖ s ‖ x ‖ y` in,
/// the word 1 out for a valid signature, nothing otherwise. Etch its code at `0x100`.
/// @dev Like the precompile it accepts high `s` (OpenZeppelin's verifier only takes low `s`, so it checks the
/// equivalent `n - s`) and rejects `r` or `s` outside `[1, n)`.
contract P256Precompile {
    fallback(bytes calldata input) external returns (bytes memory) {
        if (input.length != 160) return "";
        (bytes32 h, bytes32 r, bytes32 s, bytes32 x, bytes32 y) =
            abi.decode(input, (bytes32, bytes32, bytes32, bytes32, bytes32));
        if (uint256(s) == 0 || uint256(s) >= P256.N) return "";
        if (uint256(s) > P256.N / 2) s = bytes32(P256.N - uint256(s));
        return P256.verifySolidity(h, r, s, x, y) ? abi.encode(uint256(1)) : bytes("");
    }
}

/// @notice A P-256 precompile that answers the word 0 for an invalid signature, as some implementations do.
contract P256PrecompileAnsweringZero {
    fallback(bytes calldata input) external returns (bytes memory) {
        (bytes32 h, bytes32 r, bytes32 s, bytes32 x, bytes32 y) =
            abi.decode(input, (bytes32, bytes32, bytes32, bytes32, bytes32));
        return abi.encode(P256.verifySolidity(h, r, s, x, y) ? uint256(1) : uint256(0));
    }
}
