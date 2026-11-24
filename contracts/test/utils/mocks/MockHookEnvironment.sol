// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

interface IHook {
    function preCheck(address msgSender, uint256 msgValue, bytes calldata msgData)
        external
        returns (bytes memory);
    function postCheck(bytes calldata hookData) external;
}

/// @notice What SessionHook asks a Kernel 3.3 account: its `accountId()`, and which hook it binds to a validator
/// (`validationConfig`). It also calls the hook as Kernel does, within one call, since the hook keeps its running check
/// in transient storage.
contract MockHookAccount {
    address public boundHook;

    function accountId() external pure returns (string memory) {
        return "kernel.advanced.v0.3.3";
    }

    function bind(address hook_) external {
        boundHook = hook_;
    }

    function validationConfig(bytes21) external view returns (uint32, address) {
        return (1, boundHook);
    }

    /// @dev `preCheck` then `postCheck` with `context`, or with what `preCheck` returned when `context` is empty.
    function runChecks(IHook hook_, bytes calldata msgData, bytes calldata context) external {
        bytes memory returned = hook_.preCheck(address(0), 0, msgData);
        hook_.postCheck(context.length == 0 ? returned : context);
    }

    /// @dev Two `preCheck`s for one operation, as a re-entrant execution would.
    function preCheckTwice(IHook hook_, bytes calldata msgData) external {
        hook_.preCheck(address(0), 0, msgData);
        hook_.preCheck(address(0), 0, msgData);
    }

    /// @dev One check, then its context replayed.
    function replayContext(IHook hook_, bytes calldata msgData) external {
        bytes memory context = hook_.preCheck(address(0), 0, msgData);
        hook_.postCheck(context);
        hook_.postCheck(context);
    }

    /// @dev The account calling the hook with `call`, as one of its executions would.
    function callHook(IHook hook_, bytes calldata call) external {
        (bool success, bytes memory result) = address(hook_).call(call);
        if (!success) {
            assembly ("memory-safe") {
                revert(add(result, 0x20), mload(result))
            }
        }
    }

    /// @dev An operation whose calls make the account call `to` with `call` between the checks.
    function callDuringCheck(IHook hook_, bytes calldata msgData, address to, bytes calldata call)
        external
    {
        bytes memory context = hook_.preCheck(address(0), 0, msgData);
        (bool success, bytes memory result) = to.call(call);
        if (!success) {
            assembly ("memory-safe") {
                revert(add(result, 0x20), mload(result))
            }
        }
        hook_.postCheck(context);
    }
}

/// @notice The two Smart Sessions views SessionHook reads during execution.
contract MockSmartSessionViews {
    bool public enabled = true;
    bool public hasHook = true;

    function set(bool enabled_, bool hasHook_) external {
        enabled = enabled_;
        hasHook = hasHook_;
    }

    /// @dev Smart Sessions calling `to`, as when it enables a session.
    function forward(address to, bytes calldata call) external {
        (bool success, bytes memory result) = to.call(call);
        if (!success) {
            assembly ("memory-safe") {
                revert(add(result, 0x20), mload(result))
            }
        }
    }

    function isPermissionEnabled(bytes32, address) external view returns (bool) {
        return enabled;
    }

    function isUserOpPolicyEnabled(address, bytes32, address) external view returns (bool) {
        return hasHook;
    }
}

/// @notice Answers any call with a raw, configurable response per selector, for the malformed answers SessionHook must
/// read as "no" from an account, Smart Sessions or a policy.
contract MockProbe {
    struct Response {
        bool reverts;
        bytes data;
    }

    mapping(bytes4 selector => Response) internal responses;

    function respond(bytes4 selector, bool reverts, bytes calldata data) external {
        responses[selector] = Response(reverts, data);
    }

    fallback(bytes calldata input) external returns (bytes memory) {
        Response memory response = responses[bytes4(input[:4])];
        bytes memory data = response.data;
        if (response.reverts) {
            assembly ("memory-safe") {
                revert(add(data, 0x20), mload(data))
            }
        }
        // Raw, not ABI-encoded as `bytes`.
        assembly ("memory-safe") {
            return(add(data, 0x20), mload(data))
        }
    }
}
