// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {LibZip} from "solady/utils/LibZip.sol";

import {
    EnableSession,
    PermissionId,
    Session,
    SmartSessionMode
} from "src/smart-sessions/DataTypes.sol";
import {EncodeLib} from "src/smart-sessions/lib/EncodeLib.sol";

import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";

contract EncodeLibHarness {
    function unpackMode(bytes calldata packed)
        external
        pure
        returns (SmartSessionMode mode, PermissionId permissionId, bytes memory data)
    {
        return EncodeLib.unpackMode(packed);
    }

    function decodeEnable(bytes calldata packed)
        external
        pure
        returns (EnableSession memory enableData, bytes memory signature)
    {
        return EncodeLib.decodeEnable(packed);
    }
}

contract EncodeLibTest is SmartSessionTestBase {
    EncodeLibHarness internal harness;

    function setUp() public override {
        super.setUp();
        harness = new EncodeLibHarness();
    }

    function testFuzz_useMode_splitsPermissionAndSignature(
        bytes32 permissionId,
        bytes memory signature
    ) public view {
        (SmartSessionMode mode, PermissionId id, bytes memory data) = harness.unpackMode(
            abi.encodePacked(SmartSessionMode.USE, permissionId, signature)
        );

        assertEq(uint8(mode), uint8(SmartSessionMode.USE));
        assertEq(PermissionId.unwrap(id), permissionId);
        assertEq(data, signature);
    }

    function testFuzz_enableMode_keepsPayload(bytes memory payload) public view {
        (SmartSessionMode mode, PermissionId id, bytes memory data) =
            harness.unpackMode(abi.encodePacked(SmartSessionMode.ENABLE, payload));

        assertEq(uint8(mode), uint8(SmartSessionMode.ENABLE));
        assertEq(PermissionId.unwrap(id), bytes32(0));
        assertEq(data, payload);
    }

    function test_decodeEnable_roundTripsCompressedData() public view {
        Session memory session = defaultSession();
        EnableSession memory data = enableData(address(account), session, SmartSessionMode.ENABLE);
        bytes memory sessionSignature = hex"1234";
        bytes memory packed = LibZip.flzCompress(abi.encode(data, sessionSignature));

        (EnableSession memory decoded, bytes memory signature) = harness.decodeEnable(packed);

        assertEq(abi.encode(decoded), abi.encode(data));
        assertEq(signature, sessionSignature);
    }
}
