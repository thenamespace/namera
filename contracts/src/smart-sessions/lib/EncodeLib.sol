// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.38;

import {EnableSession, PermissionId, SmartSessionMode} from "../DataTypes.sol";
import {LibZip} from "solady/utils/LibZip.sol";

library EncodeLib {
    using LibZip for bytes;

    /// @dev Splits `userOp.signature` into the mode, the permission id (USE mode only) and the rest.
    function unpackMode(bytes calldata packed)
        internal
        pure
        returns (SmartSessionMode mode, PermissionId permissionId, bytes calldata data)
    {
        mode = SmartSessionMode(uint8(bytes1(packed[:1])));
        if (mode.isEnableMode()) {
            data = packed[1:];
        } else {
            permissionId = PermissionId.wrap(bytes32(packed[1:33]));
            data = packed[33:];
        }
    }

    /// @dev Decodes the FastLZ-compressed `abi.encode(EnableSession, bytes signature)`.
    function decodeEnable(bytes calldata packedSig)
        internal
        pure
        returns (EnableSession memory enableData, bytes memory signature)
    {
        (enableData, signature) = abi.decode(packedSig.flzDecompress(), (EnableSession, bytes));
    }
}
