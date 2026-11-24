// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Period} from "./Period.sol";

/// @notice Reads what a user operation does: the calls of its ERC-7579 `execute`, and the time its agent states.
/// @dev Written for Namera's policies, independently of Smart Sessions' AGPL execution decoder.
library UserOpCalls {
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    /// @dev `execute(bytes32 mode, bytes executionCalldata)`.
    bytes4 internal constant EXECUTE = 0xe9ae5c53;
    /// @dev `executeUserOp(PackedUserOperation, bytes32)`: Kernel with SessionHook executes the wrapped `callData[4:]`.
    bytes4 internal constant EXECUTE_USER_OP = 0x8dd7712f;
    /// @dev The last word of an operation tagged for SessionHook: `… ‖ time ‖ permissionId ‖ SESSION_HOOK_TAG`.
    bytes32 internal constant SESSION_HOOK_TAG = keccak256("namera.session-hook.tag");
    bytes1 internal constant CALLTYPE_SINGLE = 0x00;
    bytes1 internal constant CALLTYPE_BATCH = 0x01;

    error UnsupportedCallType(bytes1 callType);

    /// @dev The calls a user operation of `account` makes. `execute` yields its single call or its batch; any other
    /// account function is one call to the account itself, without value.
    function decode(bytes calldata callData, address account)
        internal
        pure
        returns (Call[] memory calls)
    {
        callData = _unwrap(callData);
        if (callData.length < 4 || bytes4(callData[:4]) != EXECUTE) {
            calls = new Call[](1);
            calls[0] = Call(account, 0, callData);
            return calls;
        }
        bytes1 callType = bytes1(callData[4:5]);
        (uint256 start, uint256 length) = _executionData(callData);
        bytes calldata execution = callData[start:start + length];

        if (callType == CALLTYPE_SINGLE) {
            calls = new Call[](1);
            calls[0] = Call(
                address(bytes20(execution[:20])), uint256(bytes32(execution[20:52])), execution[52:]
            );
            return calls;
        }
        if (callType == CALLTYPE_BATCH) return abi.decode(execution, (Call[]));
        revert UnsupportedCallType(callType);
    }

    /// @dev The time the agent states for an `execute` user operation: one 32-byte word appended after the ABI
    /// encoding of `execute`'s arguments (accounts and Smart Sessions ignore trailing calldata; the session key's
    /// signature covers it), before SessionHook's tag when there is one. `found` is false without exactly that word,
    /// or for a time with bit 47 set (EntryPoint v0.9 reads it as a block number).
    function timestamp(bytes calldata callData) internal pure returns (bool found, uint256 t) {
        callData = _unwrap(callData);
        if (callData.length >= 64 && bytes32(callData[callData.length - 32:]) == SESSION_HOOK_TAG) {
            callData = callData[:callData.length - 64];
        }
        if (callData.length < 68 || bytes4(callData[:4]) != EXECUTE) return (false, 0);
        (uint256 start, uint256 length) = _executionData(callData);
        // Rounds the length up to whole words, as the ABI pads it.
        // forge-lint: disable-next-line(divide-before-multiply)
        uint256 end = start + ((length + 31) / 32) * 32;
        if (callData.length != end + 32) return (false, 0);
        t = uint256(bytes32(callData[end:end + 32]));
        return (t <= Period.MAX_STATED_TIME, t);
    }

    /// @dev The `execute` calldata an account runs: `callData[4:]` inside `executeUserOp`.
    function _unwrap(bytes calldata callData) private pure returns (bytes calldata) {
        if (callData.length >= 4 && bytes4(callData[:4]) == EXECUTE_USER_OP) return callData[4:];
        return callData;
    }

    /// @dev Where `execute`'s `executionCalldata` starts in `callData`, and its length.
    function _executionData(bytes calldata callData)
        private
        pure
        returns (uint256 start, uint256 length)
    {
        uint256 offset = 4 + uint256(bytes32(callData[36:68]));
        length = uint256(bytes32(callData[offset:offset + 32]));
        start = offset + 32;
    }
}
