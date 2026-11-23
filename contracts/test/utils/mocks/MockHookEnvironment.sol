// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

interface IHook {
    function preCheck(address msgSender, uint256 msgValue, bytes calldata msgData)
        external
        returns (bytes memory);
    function postCheck(bytes calldata hookData) external;
}

/// @notice What SessionHook asks an account: whether it is the account's hook (Nexus, Safe7579), or bound to a
/// validator (Kernel's `validationConfig`). It also calls the hook as an account does, within one transaction, since
/// the hook keeps its running check in transient storage.
contract MockHookAccount {
    address public hook;
    address public kernelHook;

    function setHook(address hook_) external {
        hook = hook_;
    }

    function setKernelHook(address hook_) external {
        kernelHook = hook_;
    }

    function isModuleInstalled(uint256 moduleType, address module, bytes calldata)
        external
        view
        returns (bool)
    {
        return moduleType == 4 && module == hook && module != address(0);
    }

    function validationConfig(bytes21) external view returns (uint32, address) {
        return (1, kernelHook);
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
}

/// @notice The two Smart Sessions views SessionHook reads during execution.
contract MockSmartSessionViews {
    bool public enabled = true;
    bool public hasHook = true;

    function set(bool enabled_, bool hasHook_) external {
        enabled = enabled_;
        hasHook = hasHook_;
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
