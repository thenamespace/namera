// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {
    I1271Policy as Namera1271Policy,
    I1271TypedDataPolicy as Namera1271TypedDataPolicy,
    IActionPolicy as NameraActionPolicy,
    IPolicy as NameraPolicy,
    IUserOpPolicy as NameraUserOpPolicy
} from "src/policies/interfaces/IPolicy.sol";
import {Period} from "src/policies/lib/Period.sol";
import {PolicyStorage} from "src/policies/lib/PolicyStorage.sol";
import {UserOpCalls} from "src/policies/lib/UserOpCalls.sol";
import {
    I1271Policy,
    I1271TypedDataPolicy,
    IActionPolicy,
    IPolicy,
    IUserOpPolicy
} from "src/smart-sessions/interfaces/IPolicy.sol";

import {PolicyCalls} from "../../utils/PolicyCalls.sol";

contract StorageHarness {
    using PolicyStorage for PolicyStorage.Layout;

    PolicyStorage.Layout internal $;

    function write(bytes32 key, address account, bytes memory data) external {
        $.write(key, account, data);
    }

    function read(bytes32 key, address account) external view returns (bool, bytes memory) {
        return $.read(key, account);
    }
}

contract CallsHarness {
    function decode(bytes calldata callData, address account)
        external
        pure
        returns (UserOpCalls.Call[] memory)
    {
        return UserOpCalls.decode(callData, account);
    }

    function timestamp(bytes calldata callData) external pure returns (bool, uint256) {
        return UserOpCalls.timestamp(callData);
    }
}

contract PolicyInterfacesTest is Test {
    function test_interfacesMatchSmartSessions() public pure {
        assertEq(type(NameraPolicy).interfaceId, type(IPolicy).interfaceId);
        assertEq(type(NameraUserOpPolicy).interfaceId, type(IUserOpPolicy).interfaceId);
        assertEq(type(NameraActionPolicy).interfaceId, type(IActionPolicy).interfaceId);
        assertEq(type(Namera1271Policy).interfaceId, type(I1271Policy).interfaceId);
        assertEq(
            type(Namera1271TypedDataPolicy).interfaceId, type(I1271TypedDataPolicy).interfaceId
        );
        assertEq(
            NameraPolicy.initializeWithMultiplexer.selector,
            IPolicy.initializeWithMultiplexer.selector
        );
        assertEq(NameraPolicy.PolicySet.selector, IPolicy.PolicySet.selector);
    }
}

contract PeriodTest is Test {
    function test_periodsAreAlignedToTheEpoch() public pure {
        assertEq(Period.index(86_400, 86_400 * 10 + 5), 10);
        uint256 vd = Period.bounds(86_400, 86_400 * 10 + 5);
        assertEq(vd >> 208, 86_400 * 10);
        assertEq((vd >> 160) & type(uint48).max, 86_400 * 11 - 1);
        assertEq(uint160(vd), 0);
    }

    function test_theLifetimeHasNoIndexOrBounds() public pure {
        assertEq(Period.index(0, 123_456), 0);
        assertEq(Period.bounds(0, 123_456), 0);
    }

    function testFuzz_boundsContainTheTimeAndSpanOnePeriod(uint256 length, uint256 t) public pure {
        length = bound(length, 1, 365 days);
        t = bound(t, 0, type(uint48).max - length);
        uint256 vd = Period.bounds(length, t);
        uint256 validAfter = vd >> 208;
        uint256 validUntil = (vd >> 160) & type(uint48).max;
        assertLe(validAfter, t);
        assertGe(validUntil, t);
        assertEq(validUntil - validAfter + 1, length);
        assertEq(Period.index(length, validAfter), Period.index(length, validUntil));
    }

    /// @dev The EntryPoint accepts an operation inside the bounds for its stated time exactly when the actual time is
    /// in the same period, so a time outside the window can never be charged to the window's counter.
    function testFuzz_aTimeIsInTheBoundsExactlyWhenItIsInTheSamePeriod(
        uint256 length,
        uint256 stated,
        uint256 actual
    ) public pure {
        length = bound(length, 1, 365 days);
        stated = bound(stated, 0, type(uint48).max - length);
        actual = bound(actual, 0, type(uint48).max - length);
        uint256 vd = Period.bounds(length, stated);
        bool accepted = (vd >> 208) <= actual && actual <= ((vd >> 160) & type(uint48).max);
        assertEq(accepted, Period.index(length, actual) == Period.index(length, stated));
    }

    function testFuzz_intersectKeepsTheNarrowerWindow(uint48 a1, uint48 u1, uint48 a2, uint48 u2)
        public
        pure
    {
        uint256 vd = Period.intersect(_vd(a1, u1), _vd(a2, u2));
        uint256 until1 = u1 == 0 ? type(uint48).max : u1;
        uint256 until2 = u2 == 0 ? type(uint48).max : u2;
        uint256 until = until1 < until2 ? until1 : until2;
        assertEq(vd >> 208, a1 > a2 ? a1 : a2);
        assertEq((vd >> 160) & type(uint48).max, until == type(uint48).max ? 0 : until);
    }

    function _vd(uint48 validAfter, uint48 validUntil) private pure returns (uint256) {
        return (uint256(validAfter) << 208) | (uint256(validUntil) << 160);
    }
}

contract PolicyStorageTest is Test {
    StorageHarness internal harness = new StorageHarness();

    function testFuzz_readsBackWhatWasWritten(bytes memory first, bytes memory second) public {
        harness.write("key", address(this), first);
        (, bytes memory read) = harness.read("key", address(this));
        assertEq(read, first);

        harness.write("key", address(this), second);
        (bool exists, bytes memory overwritten) = harness.read("key", address(this));
        assertTrue(exists);
        assertEq(overwritten, second);
    }

    function test_keepsAccountsAndKeysApart() public {
        harness.write("key", address(1), hex"01");
        (bool other,) = harness.read("key", address(2));
        (bool otherKey,) = harness.read("other", address(1));
        (bool empty, bytes memory data) = harness.read("empty", address(3));
        assertFalse(other);
        assertFalse(otherKey);
        assertFalse(empty);
        assertEq(data.length, 0);

        harness.write("empty", address(3), "");
        (empty,) = harness.read("empty", address(3));
        assertTrue(empty);
    }
}

contract UserOpCallsTest is Test {
    CallsHarness internal harness = new CallsHarness();
    address internal account = makeAddr("account");

    function test_decodesASingleCall() public view {
        UserOpCalls.Call[] memory calls =
            harness.decode(PolicyCalls.single(address(7), 5, hex"abcd"), account);
        assertEq(calls.length, 1);
        assertEq(calls[0].target, address(7));
        assertEq(calls[0].value, 5);
        assertEq(calls[0].data, hex"abcd");
    }

    function test_decodesABatch() public view {
        UserOpCalls.Call[] memory batch = new UserOpCalls.Call[](2);
        batch[0] = UserOpCalls.Call(address(1), 1, hex"01");
        batch[1] = UserOpCalls.Call(address(2), 2, "");
        UserOpCalls.Call[] memory calls = harness.decode(PolicyCalls.batch(batch), account);
        assertEq(calls.length, 2);
        assertEq(calls[1].target, address(2));
        assertEq(calls[1].value, 2);
    }

    function test_treatsAnyOtherAccountFunctionAsACallToTheAccount() public view {
        UserOpCalls.Call[] memory calls = harness.decode(hex"12345678aa", account);
        assertEq(calls.length, 1);
        assertEq(calls[0].target, account);
        assertEq(calls[0].value, 0);
    }

    function test_rejectsOtherCallTypes() public {
        bytes memory delegate = PolicyCalls.single(address(7), 0, "");
        delegate[4] = 0xff;
        vm.expectRevert(
            abi.encodeWithSelector(UserOpCalls.UnsupportedCallType.selector, bytes1(0xff))
        );
        harness.decode(delegate, account);
    }

    function test_readsTheStatedTimeOnlyFromExactlyOneTrailingWord() public view {
        bytes memory callData = PolicyCalls.single(address(7), 0, hex"abcdef");
        (bool found, uint256 t) = harness.timestamp(PolicyCalls.withTime(callData, 1_700_000_000));
        assertTrue(found);
        assertEq(t, 1_700_000_000);

        (found,) = harness.timestamp(callData);
        assertFalse(found);
        (found,) = harness.timestamp(abi.encodePacked(callData, uint128(1)));
        assertFalse(found);
        (found,) = harness.timestamp(abi.encodePacked(callData, uint256(1), uint256(2)));
        assertFalse(found);
        (found,) = harness.timestamp(PolicyCalls.withTime(callData, uint256(type(uint48).max) + 1));
        assertFalse(found);
        (found,) = harness.timestamp(abi.encodePacked(bytes4(0x12345678), uint256(1)));
        assertFalse(found);
    }
}
