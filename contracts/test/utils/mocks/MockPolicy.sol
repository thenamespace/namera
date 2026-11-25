// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {ConfigId} from "src/smart-sessions/DataTypes.sol";
import {
    I1271Policy,
    IActionPolicy,
    IPolicy,
    IUserOpPolicy
} from "src/smart-sessions/interfaces/IPolicy.sol";

/// @notice Policy whose answer is set per session through its init data.
/// @dev `initData` is `abi.encode(MockPolicy.Config)`. State is keyed like a real policy:
/// configId => multiplexer => account.
contract MockPolicy is IUserOpPolicy, IActionPolicy, I1271Policy {
    struct Config {
        uint256 validationData;
        bool allowSignature;
        bool revertOnCheck;
    }

    struct ActionCall {
        address target;
        uint256 value;
        bytes data;
    }

    error CheckReverted();

    bool public immutable reportsInterfaces;

    mapping(ConfigId => mapping(address multiplexer => mapping(address account => Config))) public
        configs;
    mapping(ConfigId => mapping(address multiplexer => mapping(address account => uint256))) public
        checkCount;
    ActionCall public lastAction;

    constructor(bool reportsInterfaces_) {
        reportsInterfaces = reportsInterfaces_;
    }

    function supportsInterface(bytes4 interfaceId) external view returns (bool) {
        if (!reportsInterfaces) return false;
        return interfaceId == type(IUserOpPolicy).interfaceId
            || interfaceId == type(IActionPolicy).interfaceId
            || interfaceId == type(I1271Policy).interfaceId;
    }

    function initializeWithMultiplexer(address account, ConfigId configId, bytes calldata initData)
        external
    {
        configs[configId][msg.sender][account] = abi.decode(initData, (Config));
        emit IPolicy.PolicySet(configId, msg.sender, account);
    }

    function checkUserOpPolicy(ConfigId id, ERC4337.PackedUserOperation calldata userOp)
        external
        returns (uint256)
    {
        return _check(id, userOp.sender);
    }

    function checkAction(
        ConfigId id,
        address account,
        address target,
        uint256 value,
        bytes calldata data
    ) external returns (uint256) {
        lastAction = ActionCall({target: target, value: value, data: data});
        return _check(id, account);
    }

    function check1271SignedAction(ConfigId id, address, address account, bytes32, bytes calldata)
        external
        view
        returns (bool)
    {
        return configs[id][msg.sender][account].allowSignature;
    }

    function _check(ConfigId id, address account) internal returns (uint256) {
        Config memory config = configs[id][msg.sender][account];
        if (config.revertOnCheck) revert CheckReverted();
        ++checkCount[id][msg.sender][account];
        return config.validationData;
    }
}

/// @notice Init data for `MockPolicy`.
library MockPolicyConfig {
    function allow() internal pure returns (bytes memory) {
        return encode(0, true, false);
    }

    function deny() internal pure returns (bytes memory) {
        return encode(1, false, false);
    }

    function returning(uint256 validationData) internal pure returns (bytes memory) {
        return encode(validationData, true, false);
    }

    function reverting() internal pure returns (bytes memory) {
        return encode(0, false, true);
    }

    function encode(uint256 validationData, bool allowSignature, bool revertOnCheck)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(
            MockPolicy.Config({
                validationData: validationData,
                allowSignature: allowSignature,
                revertOnCheck: revertOnCheck
            })
        );
    }
}
