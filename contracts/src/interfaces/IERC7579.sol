// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// ERC-7579 types and interfaces, as specified in https://eips.ethereum.org/EIPS/eip-7579.

/*//////////////////////////////////////////////////////////////
                         EXECUTION MODE
//////////////////////////////////////////////////////////////*/

/// @dev Execution mode: callType (1 byte) ‖ execType (1 byte) ‖ unused (4) ‖ selector (4) ‖ payload (22).
type ModeCode is bytes32;

type CallType is bytes1;

type ExecType is bytes1;

CallType constant CALLTYPE_SINGLE = CallType.wrap(0x00);
CallType constant CALLTYPE_BATCH = CallType.wrap(0x01);
CallType constant CALLTYPE_STATIC = CallType.wrap(0xFE);
CallType constant CALLTYPE_DELEGATECALL = CallType.wrap(0xFF);

ExecType constant EXECTYPE_DEFAULT = ExecType.wrap(0x00);
ExecType constant EXECTYPE_TRY = ExecType.wrap(0x01);

using {eqCallType as ==} for CallType global;
using {eqExecType as ==} for ExecType global;

function eqCallType(CallType a, CallType b) pure returns (bool) {
    return CallType.unwrap(a) == CallType.unwrap(b);
}

function eqExecType(ExecType a, ExecType b) pure returns (bool) {
    return ExecType.unwrap(a) == ExecType.unwrap(b);
}

struct Execution {
    address target;
    uint256 value;
    bytes callData;
}

/*//////////////////////////////////////////////////////////////
                            ACCOUNT
//////////////////////////////////////////////////////////////*/

interface IERC7579Account {
    function execute(ModeCode mode, bytes calldata executionCalldata) external payable;

    function executeFromExecutor(ModeCode mode, bytes calldata executionCalldata)
        external
        payable
        returns (bytes[] memory returnData);

    function installModule(uint256 moduleTypeId, address module, bytes calldata initData)
        external
        payable;

    function uninstallModule(uint256 moduleTypeId, address module, bytes calldata deInitData)
        external
        payable;

    function isModuleInstalled(
        uint256 moduleTypeId,
        address module,
        bytes calldata additionalContext
    ) external view returns (bool);

    function supportsExecutionMode(ModeCode encodedMode) external view returns (bool);

    function supportsModule(uint256 moduleTypeId) external view returns (bool);

    function accountId() external view returns (string memory accountImplementationId);
}

/*//////////////////////////////////////////////////////////////
                            MODULES
//////////////////////////////////////////////////////////////*/

uint256 constant MODULE_TYPE_VALIDATOR = 1;
uint256 constant MODULE_TYPE_EXECUTOR = 2;
uint256 constant MODULE_TYPE_FALLBACK = 3;
uint256 constant MODULE_TYPE_HOOK = 4;

uint256 constant VALIDATION_SUCCESS = 0;
uint256 constant VALIDATION_FAILED = 1;

interface IModule {
    error AlreadyInitialized(address smartAccount);
    error NotInitialized(address smartAccount);

    function onInstall(bytes calldata data) external;

    function onUninstall(bytes calldata data) external;

    function isModuleType(uint256 moduleTypeId) external view returns (bool);

    function isInitialized(address smartAccount) external view returns (bool);
}
