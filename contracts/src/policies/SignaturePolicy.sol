// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {I1271Policy} from "./interfaces/IPolicy.sol";
import {PolicyBase} from "./lib/PolicyBase.sol";

/// @title SignaturePolicy
/// @notice Which contracts may verify a session key's ERC-1271 signatures: the verifying contract (Permit2, a
/// token's `permit`) must be listed.
/// @dev `initData` is `abi.encode(address[] verifiers)`. Smart Sessions itself restricts what may be signed to the
/// session's allowed app domains and content types; this policy restricts who may accept it. Smart Sessions only
/// gives ERC-1271 policies the final nested hash and the session key's signature, not the signed message, so
/// conditions on message fields (a permit's spender or value) are not possible here.
// slither-disable-next-line missing-inheritance
contract SignaturePolicy is PolicyBase, I1271Policy {
    function check1271SignedAction(
        bytes32 id,
        address requestSender,
        address account,
        bytes32,
        bytes calldata
    ) external view returns (bool) {
        address[] memory verifiers = abi.decode(_config(id, account), (address[]));
        for (uint256 i; i < verifiers.length; ++i) {
            if (verifiers[i] == requestSender) return true;
        }
        return false;
    }

    function _supportsKind(bytes4 interfaceId) internal pure override returns (bool) {
        return interfaceId == type(I1271Policy).interfaceId;
    }

    function _validateConfig(bytes calldata initData) internal pure override {
        abi.decode(initData, (address[]));
    }
}
